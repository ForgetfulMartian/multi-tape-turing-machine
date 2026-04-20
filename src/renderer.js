/**
 * Renderer — Handles all DOM rendering and visualization
 * Monochrome / Sophisticated theme
 */
import { BLANK, STATES, STATE_LABELS, MultiTapeTuringMachine, binToDec } from './turing-machine.js';

const TAPE_CLASSES = ['', 'tape-b', 'tape-out'];

export class Renderer {
  constructor() {
    this.tapeTracks = [
      document.getElementById('tape-0-track'),
      document.getElementById('tape-1-track'),
      document.getElementById('tape-2-track'),
    ];
    this.tapesEmpty = document.getElementById('tapes-empty');
    this.tapesRender = document.getElementById('tapes-render');
    this.stateCanvas = document.getElementById('state-diagram');
    this.stateCtx = this.stateCanvas.getContext('2d');
    this.transitionTableBody = document.getElementById('transition-table-body');
    this.execLog = document.getElementById('exec-log');
    this.resultBanner = document.getElementById('result-banner');
    this.resultValue = document.getElementById('result-value');
    this.resultDecimal = document.getElementById('result-decimal');

    // Status elements
    this.statusState = document.getElementById('status-state');
    this.statusStep = document.getElementById('status-step');
    this.statusCarry = document.getElementById('status-carry');
    this.statusRunning = document.getElementById('status-running');
    this.statusDesc = document.getElementById('status-desc');

    this._initTransitionTable();
    this._resizeCanvas();
    window.addEventListener('resize', () => this._resizeCanvas());
  }

  _resizeCanvas() {
    const container = this.stateCanvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = 260;
    this.stateCanvas.width = w * dpr;
    this.stateCanvas.height = h * dpr;
    this.stateCanvas.style.width = w + 'px';
    this.stateCanvas.style.height = h + 'px';
    this.stateCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._drawStateDiagram(null);
  }

  showTapes(show) {
    this.tapesEmpty.style.display = show ? 'none' : 'block';
    this.tapesRender.style.display = show ? 'block' : 'none';
  }

  renderTapes(snapshot) {
    if (!snapshot) return;

    for (let t = 0; t < 3; t++) {
      const track = this.tapeTracks[t];
      track.innerHTML = '';

      const tape = snapshot.tapes[t];
      const head = snapshot.heads[t];

      for (let i = 0; i < tape.length; i++) {
        const cell = document.createElement('div');
        cell.className = 'tape-cell';
        if (TAPE_CLASSES[t]) cell.classList.add(TAPE_CLASSES[t]);

        const symbol = tape[i];
        if (symbol === BLANK) {
          cell.classList.add('blank');
          cell.textContent = 'B';
        } else {
          cell.textContent = symbol;
        }

        if (i === head) {
          cell.classList.add('active');
        }

        if (snapshot.transition && snapshot.transition.write && snapshot.transition.write[t] !== null && i === head) {
          cell.classList.add('written');
        }

        track.appendChild(cell);
      }

      this._scrollToHead(track, head, tape.length);
    }
  }

  _scrollToHead(track, head) {
    requestAnimationFrame(() => {
      const cells = track.querySelectorAll('.tape-cell');
      if (cells[head]) {
        cells[head].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
  }

  updateStatus(snapshot, isPlaying) {
    if (!snapshot) {
      this.statusState.textContent = '—';
      this.statusStep.textContent = '0';
      this.statusCarry.textContent = '0';
      this.statusRunning.textContent = 'Idle';
      this.statusRunning.style.color = 'var(--text-tertiary)';
      this.statusDesc.textContent = 'Load inputs to begin';
      return;
    }

    this.statusState.textContent = snapshot.state;
    this.statusStep.textContent = snapshot.stepNumber;

    if (snapshot.state === STATES.ADD1) {
      this.statusCarry.textContent = '1';
      this.statusCarry.style.color = 'var(--accent-warn)';
    } else {
      this.statusCarry.textContent = '0';
      this.statusCarry.style.color = 'var(--text-primary)';
    }

    if (snapshot.state === STATES.ACCEPT) {
      this.statusRunning.textContent = '✓ Halted';
      this.statusRunning.style.color = 'var(--accent-success)';
    } else if (isPlaying) {
      this.statusRunning.textContent = '▶ Running';
      this.statusRunning.style.color = 'var(--accent-highlight)';
    } else {
      this.statusRunning.textContent = '⏸ Paused';
      this.statusRunning.style.color = 'var(--accent-warn)';
    }

    const label = STATE_LABELS[snapshot.state] || snapshot.state;
    const transDesc = snapshot.transition ? snapshot.transition.description : '';
    this.statusDesc.textContent = transDesc || label;
  }

  /**
   * Draw the state diagram — monochrome theme
   */
  _drawStateDiagram(currentState) {
    const ctx = this.stateCtx;
    const w = this.stateCanvas.width / (window.devicePixelRatio || 1);
    const h = this.stateCanvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, w, h);

    // Refined dark theme colors
    const states = [
      { id: STATES.INIT, label: 'q_init', shortLabel: 'q₀', color: '#63636e', activeColor: '#ececef' },
      { id: STATES.ADD0, label: 'q_add0', shortLabel: 'q₁', color: '#63636e', activeColor: '#3b82f6' },
      { id: STATES.ADD1, label: 'q_add1', shortLabel: 'q₂', color: '#63636e', activeColor: '#f59e0b' },
      { id: STATES.DONE, label: 'q_done', shortLabel: 'q₃', color: '#63636e', activeColor: '#8b5cf6' },
      { id: STATES.ACCEPT, label: 'q_accept', shortLabel: 'q✓', color: '#63636e', activeColor: '#10b981' },
    ];

    const padding = 75;
    const usableW = w - padding * 2;
    const cy = h / 2 + 15;
    const spacing = usableW / (states.length - 1);

    const nodes = states.map((s, i) => ({
      ...s,
      x: padding + i * spacing,
      y: cy,
      radius: 30,
    }));

    // Transitions with standard TM notation: read / write / move
    // For multi-tape: (T1,T2) / T3 / Dir
    const transitions = [
      { from: 0, to: 1, label: '—/—/seek' },
      { from: 1, to: 1, label: '(0,0)/0/L', self: true },
      { from: 1, to: 2, label: '(1,1)/0/L' },
      { from: 2, to: 1, label: '(0,0)/1/L' },
      { from: 2, to: 2, label: '(1,1)/1/L', self: true },
      { from: 1, to: 3, label: '(B,B)/—/R' },
      { from: 2, to: 3, label: '(B,B)/1/R' },
      { from: 3, to: 4, label: '—/—/halt' },
    ];

    // Draw arrows
    transitions.forEach(t => {
      const fromNode = nodes[t.from];
      const toNode = nodes[t.to];

      if (t.self) {
        this._drawSelfLoop(ctx, fromNode, t.label, fromNode.id === currentState);
      } else {
        this._drawArrow(ctx, fromNode, toNode, t.label,
          fromNode.id === currentState && toNode.id !== currentState ? false :
          currentState === fromNode.id);
      }
    });

    // Draw nodes
    nodes.forEach(node => {
      const isActive = node.id === currentState;
      this._drawStateNode(ctx, node, isActive);
    });

    // Start arrow
    const startNode = nodes[0];
    ctx.beginPath();
    ctx.moveTo(startNode.x - startNode.radius - 35, startNode.y);
    ctx.lineTo(startNode.x - startNode.radius - 4, startNode.y);
    ctx.strokeStyle = '#63636e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(startNode.x - startNode.radius - 4, startNode.y);
    ctx.lineTo(startNode.x - startNode.radius - 12, startNode.y - 6);
    ctx.lineTo(startNode.x - startNode.radius - 12, startNode.y + 6);
    ctx.closePath();
    ctx.fillStyle = '#63636e';
    ctx.fill();
  }

  _drawStateNode(ctx, node, isActive) {
    const { x, y, radius, color, activeColor, shortLabel, label } = node;
    const drawColor = isActive ? activeColor : color;

    // Subtle highlight ring
    if (isActive) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 7, 0, Math.PI * 2);
      ctx.fillStyle = activeColor + '12';
      ctx.fill();
    }

    // Node circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? activeColor + '15' : '#19191c';
    ctx.fill();
    ctx.lineWidth = isActive ? 2 : 1.2;
    ctx.strokeStyle = isActive ? activeColor : '#2e2e33';
    ctx.stroke();

    // Double circle for accept state
    if (node.id === STATES.ACCEPT) {
      ctx.beginPath();
      ctx.arc(x, y, radius - 5, 0, Math.PI * 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = isActive ? activeColor : '#2e2e33';
      ctx.stroke();
    }

    // Label inside
    ctx.font = `600 ${isActive ? '14px' : '13px'} 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isActive ? activeColor : '#63636e';
    ctx.fillText(shortLabel, x, y);

    // Label below
    ctx.font = `500 10px 'Inter', sans-serif`;
    ctx.fillStyle = isActive ? activeColor + 'bb' : '#4a4a54';
    ctx.fillText(label, x, y + radius + 18);
  }

  _drawArrow(ctx, from, to, label, isActive) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / dist;
    const ny = dy / dist;

    const startX = from.x + nx * from.radius;
    const startY = from.y + ny * from.radius;
    const endX = to.x - nx * to.radius;
    const endY = to.y - ny * to.radius;

    const activeColor = isActive ? (from.activeColor || '#ececef') : '#2e2e33';

    let needsCurve = false;
    let curveDir = 0;

    if (from.id === STATES.ADD0 && to.id === STATES.DONE) {
      needsCurve = true;
      curveDir = -95; // Arcs over q_add1 completely
    } else if (from.id === STATES.ADD0 && to.id === STATES.ADD1) {
      needsCurve = true;
      curveDir = -35; // Arcs slightly over
    } else if (from.id === STATES.ADD1 && to.id === STATES.ADD0) {
      needsCurve = true;
      curveDir = 35; // Arcs slightly under
    }

    ctx.beginPath();
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = isActive ? 1.6 : 0.8;

    if (needsCurve) {
      const isTop = curveDir < 0;
      const angleOff = Math.PI / 6; // 30 degrees off from dead center
      const dirX = Math.sign(to.x - from.x);
      
      // Calculate smooth departure/arrival points tangent to the circle
      const cStartX = from.x + dirX * from.radius * Math.sin(angleOff);
      const cStartY = isTop ? from.y - from.radius * Math.cos(angleOff) : from.y + from.radius * Math.cos(angleOff);
      
      const cEndX = to.x - dirX * to.radius * Math.sin(angleOff);
      const cEndY = isTop ? to.y - to.radius * Math.cos(angleOff) : to.y + to.radius * Math.cos(angleOff);

      const midX = (cStartX + cEndX) / 2;
      const midY = cStartY + curveDir;
      
      ctx.moveTo(cStartX, cStartY);
      ctx.quadraticCurveTo(midX, midY, cEndX, cEndY);
      ctx.stroke();

      // Arrowhead for curve
      const arrowSize = 8;
      const angle = Math.atan2(cEndY - midY, cEndX - midX);
      ctx.beginPath();
      ctx.moveTo(cEndX, cEndY);
      ctx.lineTo(cEndX - arrowSize * Math.cos(angle - 0.3), cEndY - arrowSize * Math.sin(angle - 0.3));
      ctx.lineTo(cEndX - arrowSize * Math.cos(angle + 0.3), cEndY - arrowSize * Math.sin(angle + 0.3));
      ctx.closePath();
      ctx.fillStyle = activeColor;
      ctx.fill();

      // Label
      const labelX = midX;
      const peakY = cStartY + curveDir / 2;
      const labelY = peakY + (curveDir > 0 ? 14 : -9); 
      ctx.font = `500 9px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = isActive ? from.activeColor : '#4a4a54';
      ctx.fillText(label, labelX, labelY);
    } else {
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Arrowhead
      const arrowSize = 8;
      const angle = Math.atan2(endY - startY, endX - startX);
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - arrowSize * Math.cos(angle - 0.4), endY - arrowSize * Math.sin(angle - 0.4));
      ctx.lineTo(endX - arrowSize * Math.cos(angle + 0.4), endY - arrowSize * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fillStyle = activeColor;
      ctx.fill();

      const labelX = (startX + endX) / 2;
      const labelY = (startY + endY) / 2 - 12;
      ctx.font = `500 9px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = isActive ? from.activeColor : '#4a4a54';
      ctx.fillText(label, labelX, labelY);
    }
  }

  _drawSelfLoop(ctx, node, label, isActive) {
    const { x, y, radius, activeColor } = node;
    const loopRadius = 22;
    const loopY = y - radius - loopRadius + 4;

    ctx.beginPath();
    // Adjusted arc angles to make the loop look less flat and more circular, starting/ending higher
    ctx.arc(x, loopY, loopRadius, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.strokeStyle = isActive ? activeColor : '#2e2e33';
    ctx.lineWidth = isActive ? 1.6 : 0.8;
    ctx.stroke();

    // Multi-line label for TM notation
    const parts = label.split('/');
    ctx.font = `500 9px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = isActive ? activeColor : '#4a4a54';
    if (parts.length >= 3) {
      ctx.fillText(parts[0]+'/'+parts[1], x, loopY - loopRadius - 12);
      ctx.fillText(parts[2], x, loopY - loopRadius + 1);
    } else {
      ctx.fillText(label, x, loopY - loopRadius - 5);
    }
  }

  drawStateDiagram(currentState) {
    this._drawStateDiagram(currentState);
  }

  _initTransitionTable() {
    const rows = MultiTapeTuringMachine.getTransitionTable();
    this.transitionTableBody.innerHTML = '';

    rows.forEach((row, i) => {
      const tr = document.createElement('tr');
      tr.dataset.index = i;
      tr.innerHTML = `
        <td>${row.from}</td>
        <td>${row.read}</td>
        <td>${row.write}</td>
        <td>${row.move}</td>
        <td>${row.to}</td>
      `;
      tr.title = row.desc;
      this.transitionTableBody.appendChild(tr);
    });
  }

  highlightTransition(snapshot) {
    const rows = this.transitionTableBody.querySelectorAll('tr');
    rows.forEach(r => r.classList.remove('active-transition'));

    if (!snapshot || !snapshot.transition) return;

    const t = snapshot.transition;
    rows.forEach(r => {
      const cells = r.querySelectorAll('td');
      if (cells[0].textContent === t.from && cells[4].textContent === t.to) {
        r.classList.add('active-transition');
        r.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  addLogEntry(snapshot, isCurrent = true) {
    if (!snapshot || !snapshot.transition) return;

    const empty = this.execLog.querySelector('.empty-state');
    if (empty) empty.remove();

    if (isCurrent) {
      this.execLog.querySelectorAll('.log-entry.current').forEach(e => e.classList.remove('current'));
    }

    const entry = document.createElement('div');
    entry.className = 'log-entry' + (isCurrent ? ' current' : '');
    entry.dataset.step = snapshot.stepNumber;

    entry.innerHTML = `
      <span class="log-step">#${snapshot.stepNumber}</span>
      <span class="log-state">${snapshot.transition.from}→${snapshot.transition.to}</span>
      <span class="log-desc">${snapshot.transition.description}</span>
    `;

    this.execLog.appendChild(entry);
    entry.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  clearLog() {
    this.execLog.innerHTML = `
      <div class="empty-state" style="padding:1.5rem 0;">
        <div class="empty-state__text" style="font-size:0.72rem;">Steps appear here during execution</div>
      </div>
    `;
  }

  highlightLogEntry(stepNumber) {
    this.execLog.querySelectorAll('.log-entry').forEach(e => {
      e.classList.toggle('current', parseInt(e.dataset.step) === stepNumber);
    });
    const current = this.execLog.querySelector('.log-entry.current');
    if (current) current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  showResult(binaryResult) {
    const decimal = binToDec(binaryResult);
    this.resultValue.textContent = binaryResult + '₂';
    this.resultDecimal.textContent = `= ${decimal} (decimal)`;
    this.resultBanner.classList.add('visible');
  }

  hideResult() {
    this.resultBanner.classList.remove('visible');
  }

  renderSnapshot(snapshot, isPlaying) {
    this.renderTapes(snapshot);
    this.updateStatus(snapshot, isPlaying);
    this.drawStateDiagram(snapshot ? snapshot.state : null);
    this.highlightTransition(snapshot);
  }
}

/**
 * Background — no-op for clean monochrome theme
 */
export function initBackground() {
  // No particle background in monochrome theme
}
