(function () {
  const TAG = 'eval-dashboard';
  if (customElements.get(TAG)) return;

  const CASES = [
    ['normal', '정상적인 결함 환불', false, true, true],
    ['none', '주문을 찾을 수 없음', false, true, true],
    ['multiple', '후보 주문이 여러 개', false, false, true],
    ['reason', '환불 사유 누락', false, false, true],
    ['stale', '오래된 정책 문서', false, false, true],
    ['digital', '사용한 디지털 상품', true, false, true],
    ['approval', '100,000원 초과 승인', true, false, true],
    ['timeout', '상태 변경 직후 타임아웃', true, false, true],
    ['duplicate', '중복 사용자 요청', true, false, true],
    ['injection', '오염된 정책 문서', true, false, true],
    ['confirmation', '사용자 확인 없음', true, false, true],
    ['unknown', '부분 성공 후 상태 불명', true, false, true]
  ];

  const STYLE = `
    :host{display:block;color:var(--course-text,#20242c);font:15px/1.5 system-ui,sans-serif}*{box-sizing:border-box}
    .box{background:var(--course-surface,#fff);border:1px solid var(--course-border,#d9dde5);border-radius:12px;padding:16px}h3{font-size:1.05rem;margin:0 0 4px}
    .intro{color:var(--course-muted,#5d6675);margin:0 0 12px}.tabs{display:flex;flex-wrap:wrap;gap:8px}.tabs button,.decision button{border:1px solid var(--course-border,#d9dde5);border-radius:7px;cursor:pointer;font:inherit;font-weight:650;padding:8px 12px}
    .tabs button[aria-pressed=true]{background:var(--course-accent,#5b4bc4);border-color:var(--course-accent,#5b4bc4);color:#fff}
    button:focus-visible{outline:3px solid var(--course-accent,#5b4bc4);outline-offset:2px}.summary{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin:12px 0}
    .metric{background:var(--course-surface-soft,#f6f7f9);border-radius:8px;padding:10px}.metric strong{display:block;font-size:1.25rem}
    .table-wrap{max-width:100%;overflow:auto}table{border-collapse:collapse;min-width:520px;width:100%}caption{font-weight:700;padding:6px;text-align:left}th,td{border-bottom:1px solid var(--course-border,#d9dde5);padding:8px;text-align:left}
    .pass{color:var(--course-success,#176b3a);font-weight:700}.fail{color:var(--course-danger,#a12828);font-weight:700}.critical{font-weight:700}
    .decision{background:var(--course-surface-soft,#f6f7f9);border-radius:8px;margin-top:12px;padding:12px}.decision p{margin-top:0}.release{background:var(--course-success,#176b3a);color:#fff}.hold{background:var(--course-danger,#a12828);color:#fff}.status{border-radius:8px;margin-top:10px;padding:10px}.status:empty{display:none}
    .ok{background:var(--course-success-soft,#e8f6ed);color:var(--course-success,#176b3a)}.bad{background:var(--course-danger-soft,#fdecec);color:var(--course-danger,#a12828)}
  `;

  class EvalDashboard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.version = 'before';
    }

    connectedCallback() {
      if (this.dataset.ready) return;
      this.dataset.ready = 'true';
      const style = document.createElement('style');
      style.textContent = STYLE;
      const box = document.createElement('section');
      box.className = 'box';
      const title = document.createElement('h3');
      title.id = 'eval-title';
      title.textContent = '변경 전후 고정 평가 세트';
      box.setAttribute('aria-labelledby', title.id);
      const intro = document.createElement('p');
      intro.className = 'intro';
      intro.textContent = '평균 점수뿐 아니라 안전 게이트 위반이 0건인지 확인한 뒤 출시를 결정하세요.';
      this.tabs = document.createElement('div');
      this.tabs.className = 'tabs';
      this.tabs.setAttribute('aria-label', '평가 버전');
      [['before', '변경 전'], ['after', '하네스 적용 후']].forEach(([id, label]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.version = id;
        button.textContent = label;
        button.addEventListener('click', () => {
          this.version = id;
          this.renderTable();
        });
        this.tabs.appendChild(button);
      });
      this.summary = document.createElement('div');
      this.summary.className = 'summary';
      const wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      this.table = document.createElement('table');
      wrap.appendChild(this.table);
      const decision = document.createElement('div');
      decision.className = 'decision';
      const question = document.createElement('p');
      question.textContent = '이 후보 버전을 출시해야 할까요?';
      const release = this.decisionButton('출시', 'release', 'release');
      const hold = this.decisionButton('보류', 'hold', 'hold');
      this.status = document.createElement('div');
      this.status.className = 'status';
      this.status.setAttribute('role', 'status');
      this.status.setAttribute('aria-live', 'polite');
      decision.append(question, release, document.createTextNode(' '), hold, this.status);
      box.append(title, intro, this.tabs, this.summary, wrap, decision);
      this.shadowRoot.append(style, box);
      this.renderTable();
    }

    decisionButton(label, className, value) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = className;
      button.textContent = label;
      button.addEventListener('click', () => this.decide(value));
      return button;
    }

    renderTable() {
      [...this.tabs.children].forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.version === this.version));
      });
      const index = this.version === 'before' ? 3 : 4;
      const passed = CASES.filter((item) => item[index]).length;
      const criticalFailures = CASES.filter((item) => item[2] && !item[index]).length;
      this.summary.replaceChildren(
        this.metric(`${passed} / ${CASES.length}`, '통과 시나리오'),
        this.metric(`${Math.round(passed / CASES.length * 100)}%`, '전체 성공률'),
        this.metric(`${criticalFailures}건`, '안전 게이트 위반')
      );
      this.table.replaceChildren();
      const caption = document.createElement('caption');
      caption.textContent = this.version === 'before' ? '변경 전 평가 결과' : '하네스 적용 후 평가 결과';
      const head = document.createElement('thead');
      const hr = document.createElement('tr');
      ['시나리오', '분류', '결과'].forEach((label) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = label;
        hr.appendChild(th);
      });
      head.appendChild(hr);
      const body = document.createElement('tbody');
      CASES.forEach((item) => {
        const row = document.createElement('tr');
        const name = document.createElement('td');
        name.textContent = item[1];
        const type = document.createElement('td');
        type.textContent = item[2] ? '필수 안전 게이트' : '일반 기능';
        if (item[2]) type.className = 'critical';
        const result = document.createElement('td');
        result.textContent = item[index] ? '통과' : '실패';
        result.className = item[index] ? 'pass' : 'fail';
        row.append(name, type, result);
        body.appendChild(row);
      });
      this.table.append(caption, head, body);
      this.status.textContent = '';
      this.status.className = 'status';
    }

    metric(value, label) {
      const metric = document.createElement('div');
      metric.className = 'metric';
      const strong = document.createElement('strong');
      strong.textContent = value;
      const span = document.createElement('span');
      span.textContent = label;
      metric.append(strong, span);
      return metric;
    }

    decide(value) {
      const correct = this.version === 'after' ? 'release' : 'hold';
      if (value !== correct) {
        this.setStatus(this.version === 'before'
          ? '보류해야 합니다. 전체 성공률보다 먼저 확인 없는 환불·중복 환불 같은 안전 게이트 위반을 보세요.'
          : '이 버전은 12개 시나리오와 모든 필수 안전 게이트를 통과했습니다. 이 고정 세트 기준으로는 출시할 수 있습니다.', false);
        return;
      }
      this.setStatus(this.version === 'before'
        ? '맞습니다. 필수 안전 게이트 위반이 한 건이라도 있으므로 출시를 보류해야 합니다.'
        : '맞습니다. 고정 평가 세트와 필수 안전 게이트를 모두 통과했습니다.', true);
      this.dispatchEvent(new CustomEvent('course-interaction-complete', {
        bubbles: true,
        composed: true,
        detail: { id: TAG, score: 100, version: this.version }
      }));
    }

    setStatus(message, ok) {
      this.status.textContent = message;
      this.status.className = `status ${ok ? 'ok' : 'bad'}`;
    }
  }

  customElements.define(TAG, EvalDashboard);
})();
