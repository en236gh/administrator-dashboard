import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
const require = createRequire(import.meta.url);

function load(file, overrides) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => overrides[name] ?? require(name), console, FormData: class { constructor(form) { return form; } } });
  return exports;
}
function harness(detail, respond = () => undefined) {
  const states = [];
  let cursor = 0;
  const calls = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return states[index] ??= { current: initial }; },
    useEffect() {},
  };
  const action = async (operation, ...args) => {
    calls.push({ operation, args });
    return respond(operation, ...args) ?? { ok: true, status: 200, message: 'OK', data: operation === 'detail' ? detail : operation === 'list' ? [detail] : [] };
  };
  const { SchedulingWorkspace } = load('components/admin/scheduling-workspace.tsx', {
    react, 'react/jsx-runtime': jsx,
    '@/components/ui/button': { Button: 'button' },
    '@/components/ui/select': { Select: 'select' },
    '@/components/admin/amendment-form': { AmendmentForm: 'amendment-form' },
    '@/lib/actions/scheduling': { schedulingAction: action },
  });
  function render() { cursor = 0; return SchedulingWorkspace(); }
  function nodes(node, predicate) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(n => nodes(n, predicate));
    return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
  }
  function button(label) { const found = nodes(render(), n => n.type === 'button' && (n.props.children === label || (Array.isArray(n.props.children) && n.props.children.includes(label))))[0]; assert.ok(found, label); return found; }
  async function click(label) { await button(label).props.onClick(); }
  async function select() {
    nodes(render(), n => n.props?.['aria-label'] === 'Examination period')[0].props.onChange({ target: { value: '7' } });
    await new Promise(resolve => setImmediate(resolve));
  }
  return { render, nodes, button, click, select, calls };
}
const period = { period_id: 7, revision: 4, status: 'DRAFT', name: 'Final', slots: [], courses: [], exams: [], bookings: [], allocations: [], unallocatedStudents: [], assignments: [], conflictingExams: [] };

test('ordinary Administrator can generate without coordinator capability fields', async () => {
  const h = harness(period);
  await h.select(); await h.click('Timetable');
  assert.equal(h.button('Regenerate schedule').props.disabled, false);
});

test('publication requires a clean validation and a failed recheck disables it', async () => {
  let checks = 0;
  const h = harness(period, operation => operation === 'validate' ? (++checks === 1
    ? { ok: true, status: 200, data: { valid: true, problems: [] } }
    : { ok: false, status: 400, message: 'Missing staff', data: { problems: ['Missing staff'] } }) : undefined);
  await h.select(); await h.click('Publish');
  assert.equal(h.button('Publish timetable and staffing').props.disabled, true);
  await h.click('Validate publication');
  assert.equal(h.button('Publish timetable and staffing').props.disabled, false);
  await h.click('Validate publication');
  assert.equal(h.button('Publish timetable and staffing').props.disabled, true);
  assert.match(JSON.stringify(h.render()), /Missing staff/);
});

test('generation failure preserves diagnostics and latest revision', async () => {
  const h = harness(period, operation => operation === 'generate' ? {
    ok: false, status: 200, message: 'Search stopped', data: {
      generation: { period: { ...period, revision: 5 }, result: { outcome: 'SEARCH_LIMIT_REACHED', problems: ['Search budget exhausted'], unresolvedCourses: ['CSC101'] } }, staffing: [], validation: {valid:false, problems:[]},
    },
  } : undefined);
  await h.select(); await h.click('Timetable'); await h.click('Regenerate schedule');
  assert.match(JSON.stringify(h.render()), /CSC101/);
  await h.click('Try again with a higher search limit');
  assert.equal(h.calls.filter(c => c.operation === 'generate')[1].args[1].revision, 5);
});

test('published amendments expose separate Administrator decision, apply and retry actions', async () => {
  const h = harness({ ...period, status: 'PUBLISHED' }, operation => operation === 'amendments' ? {
    ok: true, status: 200, data: [{ amendment_id: 1, status: 'PENDING' }, { amendment_id: 2, status: 'APPROVED' }, { amendment_id: 3, status: 'APPLIED' }],
  } : undefined);
  await h.select(); await h.click('Amendments'); await h.click('Load amendments');
  assert.equal(h.button('Record amendment decision').props.disabled, false);
  assert.equal(h.button('Apply amendment').props.disabled, false);
  await h.click('Retry inbox delivery only');
  assert.equal(h.calls.at(-1).operation, 'retryNotifications');
  assert.equal(h.calls.some(c => c.operation === 'applyAmendment'), false);
  await h.click('Timetable');
  assert.equal(h.button('Regenerate schedule').props.disabled, true);
});

test('stale-revision conflict refreshes detail without retrying the mutation or hiding the blocker', async () => {
  const h = harness(period, operation => operation === 'generate' ? { ok: false, status: 409, message: 'Revision changed', data: null } : undefined);
  await h.select(); await h.click('Timetable'); await h.click('Regenerate schedule');
  assert.equal(h.calls.filter(c => c.operation === 'generate').length, 1);
  assert.equal(h.calls.filter(c => c.operation === 'detail').length, 2);
  assert.match(JSON.stringify(h.render()), /Revision changed/);
});

for (const editing of [false, true]) {
  test(`${editing ? 'update' : 'create'} omits academicYear from requests and the scheduling UI`, async () => {
    const saved = { ...period, academic_year: '2027/2028' };
    const h = harness(saved, operation => ['create', 'setup'].includes(operation)
      ? { ok: true, status: 200, data: editing ? saved : {generation:{period:saved,result:{outcome:'COMPLETE',problems:[]}},staffing:[],validation:{valid:true,problems:[]}} } : undefined);
    if (editing) await h.select();
    assert.doesNotMatch(JSON.stringify(h.render()), /academic.?year|2027\/2028|Automatically taken from student registrations|Determined from student registrations/i);
    for (const name of ['semester', 'examType', 'startDate', 'endDate', 'day', 'slots']) {
      assert.ok(h.nodes(h.render(), n => n.props?.name === name).length, `${name} remains visible`);
    }
    const form = h.nodes(h.render(), n => n.type === 'form')[0];
    const values = new FormData();
    Object.entries({ name: 'Final exams', academicYear: '1999/2000', semester: '1', examType: 'FINAL', startDate: '2027-06-07', endDate: '2027-06-18', slots: '09:00-12:00', day: '1' }).forEach(([key, value]) => values.set(key, value));
    form.props.onSubmit({ preventDefault() {}, currentTarget: values });
    await new Promise(resolve => setImmediate(resolve));
    const call = h.calls.find(c => c.operation === (editing ? 'setup' : 'create'));
    assert.ok(call);
    assert.equal(Object.hasOwn(call.args[1], 'academicYear'), false);
    assert.equal(call.args[1].semester, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(call.args[1].slots)), [{ startTime: '09:00', endTime: '12:00' }]);
    assert.doesNotMatch(JSON.stringify(h.render()), /academic.?year|2027\/2028|Automatically taken from student registrations|Determined from student registrations/i);
    assert.equal(saved.academic_year, '2027/2028');
  });
}

test('registration creation conflict preserves the server message without suggesting a stale revision', async () => {
  const h = harness(period, operation => operation === 'create'
    ? { ok: false, status: 409, message: 'Load student registrations before scheduling.', data: null } : undefined);
  const values = new FormData();
  values.set('slots', '09:00-12:00');
  values.set('day', '1');
  h.nodes(h.render(), n => n.type === 'form')[0].props.onSubmit({ preventDefault() {}, currentTarget: values });
  await new Promise(resolve => setImmediate(resolve));
  assert.match(JSON.stringify(h.render()), /Load student registrations before scheduling/);
  assert.doesNotMatch(JSON.stringify(h.render()), /Revision or timetable conflict/);
  assert.equal(h.calls.filter(c => c.operation === 'create').length, 1);
});


test('weekday bulk selection and clearing updates every submitted checkbox', async () => {
  const h = harness(period);
  const days = Array.from({ length: 7 }, () => ({ checked: false }));
  const event = { currentTarget: { form: { querySelectorAll: () => days } } };
  h.button('Select all days').props.onClick(event);
  assert.equal(days.every(day => day.checked), true);
  h.button('Clear days').props.onClick(event);
  assert.equal(days.every(day => !day.checked), true);
});


test('obsolete actions are rejected without calling the backend', async () => {
  const { schedulingAction } = load('lib/actions/scheduling.ts', {
    '@/lib/api/client': { apiRequest: async () => assert.fail('obsolete route called'), ApiError: class extends Error {} },
  });
  for (const operation of ['delete', 'reset', 'select']) {
    assert.equal((await schedulingAction(operation, 7)).status, 400);
  }
});

test('generated schedules can regenerate and staffing shortages block publication', async () => {
  const saved = {...period, exams:[{exam_session_id:1}]};
  const h = harness(saved, operation => operation === 'generate' ? {
    ok:true, status:200, data:{generation:{period:saved,result:{outcome:'COMPLETE',problems:[]}},
      staffing:[{understaffedVenueIds:[9]}],validation:{valid:false,problems:['Staffing incomplete']}}
  } : undefined);
  await h.select(); await h.click('Timetable');
  assert.equal(h.button('Regenerate schedule').props.disabled, false);
  await h.click('Regenerate schedule');
  assert.match(JSON.stringify(h.render()), /Venue #9 needs more invigilators/);
  await h.click('Publish');
  assert.equal(h.button('Publish timetable and staffing').props.disabled, true);
});

test('creation transport failure reloads the list before another attempt', async () => {
  const h = harness(period, operation => operation === 'create'
    ? {ok:false,status:503,message:'Connection lost',data:null} : undefined);
  const values = new FormData();
  values.set('slots','09:00-12:00'); values.set('day','1');
  h.nodes(h.render(), n => n.type === 'form')[0].props.onSubmit({preventDefault(){},currentTarget:values});
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.calls.map(c => c.operation), ['create','list']);
});

test('workspace omits course selection, deletion and reset controls', async () => {
  const h = harness(period);
  await h.select(); await h.click('Timetable');
  assert.doesNotMatch(JSON.stringify(h.render()), /Delete draft|reset draft|Save selected courses/);
});
