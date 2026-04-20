/**
 * Multi-Tape Turing Machine for Binary Addition
 * 
 * 3 Tapes:
 *   Tape 0 (Input A)  — first binary operand, read-only
 *   Tape 1 (Input B)  — second binary operand, read-only
 *   Tape 2 (Output)   — sum result, write
 * 
 * States:
 *   q_init   — position heads at LSB (rightmost bit)
 *   q_add0   — add bits, carry = 0
 *   q_add1   — add bits, carry = 1
 *   q_carry  — propagate remaining carry
 *   q_done   — rewind heads to leftmost
 *   q_accept — halt
 * 
 * Blank symbol: 'B'
 */

export const BLANK = 'B';
export const STATES = {
  INIT: 'q_init',
  ADD0: 'q_add0',
  ADD1: 'q_add1',
  CARRY: 'q_carry',
  DONE: 'q_done',
  ACCEPT: 'q_accept',
};

export const STATE_LABELS = {
  [STATES.INIT]: 'Initialize — Seek LSB',
  [STATES.ADD0]: 'Add (carry = 0)',
  [STATES.ADD1]: 'Add (carry = 1)',
  [STATES.CARRY]: 'Propagate Carry',
  [STATES.DONE]: 'Rewind Heads',
  [STATES.ACCEPT]: 'Accept — Done!',
};

// Direction constants
const L = 'L';
const R = 'R';
const S = 'S'; // Stay

/**
 * Snapshot of the TM at a point in time
 */
class TMSnapshot {
  constructor(tapes, heads, state, stepNumber, transition) {
    this.tapes = tapes.map(t => [...t]);
    this.heads = [...heads];
    this.state = state;
    this.stepNumber = stepNumber;
    this.transition = transition; // { read, write, moves, from, to }
  }
}

export class MultiTapeTuringMachine {
  constructor() {
    this.tapes = [[], [], []];
    this.heads = [0, 0, 0];
    this.state = STATES.INIT;
    this.stepCount = 0;
    this.history = [];
    this.halted = false;
    this.inputA = '';
    this.inputB = '';
  }

  /**
   * Initialize the TM with two binary strings
   */
  load(binaryA, binaryB) {
    // Validate input
    if (!/^[01]+$/.test(binaryA) || !/^[01]+$/.test(binaryB)) {
      throw new Error('Inputs must be non-empty binary strings (0s and 1s only)');
    }

    this.inputA = binaryA;
    this.inputB = binaryB;

    // Pad the shorter number with leading blanks so both tapes have same length
    const maxLen = Math.max(binaryA.length, binaryB.length);
    
    // Tape 0: Input A (with leading blanks if shorter)
    this.tapes[0] = [];
    for (let i = 0; i < maxLen - binaryA.length; i++) this.tapes[0].push(BLANK);
    for (const ch of binaryA) this.tapes[0].push(ch);

    // Tape 1: Input B (with leading blanks if shorter)
    this.tapes[1] = [];
    for (let i = 0; i < maxLen - binaryB.length; i++) this.tapes[1].push(BLANK);
    for (const ch of binaryB) this.tapes[1].push(ch);

    // Tape 2: Output tape — start with blanks, same length + 1 for possible overflow
    this.tapes[2] = [];
    for (let i = 0; i < maxLen + 1; i++) this.tapes[2].push(BLANK);

    // Heads start at leftmost position (index 0)
    this.heads = [0, 0, 0];
    this.state = STATES.INIT;
    this.stepCount = 0;
    this.history = [];
    this.halted = false;

    // Save initial snapshot
    this.history.push(new TMSnapshot(this.tapes, this.heads, this.state, 0, null));
  }

  /**
   * Read symbol at current head position on a tape
   */
  read(tapeIndex) {
    const h = this.heads[tapeIndex];
    if (h < 0 || h >= this.tapes[tapeIndex].length) return BLANK;
    return this.tapes[tapeIndex][h];
  }

  /**
   * Write symbol at current head position on a tape
   */
  write(tapeIndex, symbol) {
    const h = this.heads[tapeIndex];
    // Extend tape if needed
    while (h >= this.tapes[tapeIndex].length) {
      this.tapes[tapeIndex].push(BLANK);
    }
    if (h < 0) {
      this.tapes[tapeIndex].unshift(BLANK);
      // Shift all heads on this tape
      this.heads[tapeIndex] = 0;
    }
    this.tapes[tapeIndex][this.heads[tapeIndex]] = symbol;
  }

  /**
   * Move head on a tape
   */
  moveHead(tapeIndex, direction) {
    if (direction === L) {
      this.heads[tapeIndex]--;
      if (this.heads[tapeIndex] < 0) {
        // Extend tape to the left
        this.tapes[tapeIndex].unshift(BLANK);
        this.heads[tapeIndex] = 0;
        // Adjust other heads on same tape if needed (they all share tape but have separate indices)
      }
    } else if (direction === R) {
      this.heads[tapeIndex]++;
      if (this.heads[tapeIndex] >= this.tapes[tapeIndex].length) {
        this.tapes[tapeIndex].push(BLANK);
      }
    }
    // S = stay, do nothing
  }

  /**
   * Execute one step of the TM
   * Returns the snapshot after the step, or null if halted
   */
  step() {
    if (this.halted) return null;

    const prevState = this.state;
    let transition = null;

    switch (this.state) {
      case STATES.INIT:
        transition = this._stepInit();
        break;
      case STATES.ADD0:
        transition = this._stepAdd0();
        break;
      case STATES.ADD1:
        transition = this._stepAdd1();
        break;
      case STATES.CARRY:
        transition = this._stepCarry();
        break;
      case STATES.DONE:
        transition = this._stepDone();
        break;
      case STATES.ACCEPT:
        this.halted = true;
        return null;
    }

    this.stepCount++;
    const snapshot = new TMSnapshot(this.tapes, this.heads, this.state, this.stepCount, transition);
    this.history.push(snapshot);

    if (this.state === STATES.ACCEPT) {
      this.halted = true;
    }

    return snapshot;
  }

  /**
   * q_init: Move all heads to the rightmost position (LSB)
   */
  _stepInit() {
    const maxIdx = Math.max(
      this.tapes[0].length - 1,
      this.tapes[1].length - 1,
      this.tapes[2].length - 1
    );

    // Position heads at rightmost cell
    this.heads[0] = this.tapes[0].length - 1;
    this.heads[1] = this.tapes[1].length - 1;
    this.heads[2] = this.tapes[2].length - 1;

    const transition = {
      from: STATES.INIT,
      to: STATES.ADD0,
      read: [this.read(0), this.read(1), this.read(2)],
      write: [null, null, null],
      moves: [S, S, S],
      description: 'Position all heads at LSB'
    };

    this.state = STATES.ADD0;
    return transition;
  }

  /**
   * q_add0: Add bits with carry = 0
   */
  _stepAdd0() {
    const a = this.read(0);
    const b = this.read(1);

    const transition = {
      from: STATES.ADD0,
      read: [a, b, this.read(2)],
      write: [null, null, null],
      moves: [L, L, L],
      description: ''
    };

    // Both blank — we're done adding
    if (a === BLANK && b === BLANK) {
      transition.to = STATES.DONE;
      transition.moves = [R, R, R];
      transition.description = 'Both tapes exhausted, no carry — done';
      this.state = STATES.DONE;
      // Move heads right to start of the result
      this.moveHead(0, R);
      this.moveHead(1, R);
      this.moveHead(2, R);
      return transition;
    }

    const bitA = a === BLANK ? 0 : parseInt(a);
    const bitB = b === BLANK ? 0 : parseInt(b);
    const sum = bitA + bitB; // 0, 1, or 2

    const resultBit = (sum % 2).toString();
    const carry = Math.floor(sum / 2);

    this.write(2, resultBit);
    transition.write = [null, null, resultBit];
    transition.description = `${a === BLANK ? '0' : a} + ${b === BLANK ? '0' : b} = ${sum} → write ${resultBit}, carry ${carry}`;

    // Move all heads left
    this.moveHead(0, L);
    this.moveHead(1, L);
    this.moveHead(2, L);

    if (carry === 1) {
      this.state = STATES.ADD1;
      transition.to = STATES.ADD1;
    } else {
      this.state = STATES.ADD0;
      transition.to = STATES.ADD0;
    }

    return transition;
  }

  /**
   * q_add1: Add bits with carry = 1
   */
  _stepAdd1() {
    const a = this.read(0);
    const b = this.read(1);

    const transition = {
      from: STATES.ADD1,
      read: [a, b, this.read(2)],
      write: [null, null, null],
      moves: [L, L, L],
      description: ''
    };

    // Both blank — still have carry to write
    if (a === BLANK && b === BLANK) {
      this.write(2, '1');
      transition.write = [null, null, '1'];
      transition.to = STATES.DONE;
      transition.moves = [R, R, R];
      transition.description = 'Both tapes exhausted, write carry 1 — done';
      this.state = STATES.DONE;
      this.moveHead(0, R);
      this.moveHead(1, R);
      this.moveHead(2, R);
      return transition;
    }

    const bitA = a === BLANK ? 0 : parseInt(a);
    const bitB = b === BLANK ? 0 : parseInt(b);
    const sum = bitA + bitB + 1; // carry = 1, so 1, 2, or 3

    const resultBit = (sum % 2).toString();
    const carry = Math.floor(sum / 2);

    this.write(2, resultBit);
    transition.write = [null, null, resultBit];
    transition.description = `${a === BLANK ? '0' : a} + ${b === BLANK ? '0' : b} + carry(1) = ${sum} → write ${resultBit}, carry ${carry}`;

    this.moveHead(0, L);
    this.moveHead(1, L);
    this.moveHead(2, L);

    if (carry === 1) {
      this.state = STATES.ADD1;
      transition.to = STATES.ADD1;
    } else {
      this.state = STATES.ADD0;
      transition.to = STATES.ADD0;
    }

    return transition;
  }

  /**
   * q_carry: Propagate remaining carry (unused in current design, but kept for extensibility)
   */
  _stepCarry() {
    const transition = {
      from: STATES.CARRY,
      to: STATES.DONE,
      read: [BLANK, BLANK, this.read(2)],
      write: [null, null, '1'],
      moves: [S, S, S],
      description: 'Write final carry'
    };
    this.write(2, '1');
    this.state = STATES.DONE;
    return transition;
  }

  /**
   * q_done: Clean up — strip leading blanks from result, transition to accept
   */
  _stepDone() {
    const transition = {
      from: STATES.DONE,
      to: STATES.ACCEPT,
      read: [this.read(0), this.read(1), this.read(2)],
      write: [null, null, null],
      moves: [S, S, S],
      description: 'Computation complete — accept'
    };

    // Reset heads to start
    this.heads[0] = 0;
    this.heads[1] = 0;
    this.heads[2] = 0;

    // Skip leading blanks on output tape for display
    while (this.tapes[2].length > 1 && this.tapes[2][0] === BLANK) {
      this.tapes[2].shift();
    }

    // Also skip leading blanks on input tapes
    while (this.tapes[0].length > 1 && this.tapes[0][0] === BLANK) {
      this.tapes[0].shift();
    }
    while (this.tapes[1].length > 1 && this.tapes[1][0] === BLANK) {
      this.tapes[1].shift();
    }

    this.state = STATES.ACCEPT;
    return transition;
  }

  /**
   * Run until halted (for testing)
   */
  runToCompletion(maxSteps = 10000) {
    let steps = 0;
    while (!this.halted && steps < maxSteps) {
      this.step();
      steps++;
    }
    return this.getResult();
  }

  /**
   * Get the result from tape 2
   */
  getResult() {
    let result = this.tapes[2].join('').replace(/^B+/, '');
    if (result === '') result = '0';
    return result;
  }

  /**
   * Get snapshot at a given step
   */
  getSnapshot(stepIndex) {
    if (stepIndex >= 0 && stepIndex < this.history.length) {
      return this.history[stepIndex];
    }
    return null;
  }

  /**
   * Get current snapshot
   */
  getCurrentSnapshot() {
    return this.history[this.history.length - 1] || null;
  }

  /**
   * Get transition table for display
   */
  static getTransitionTable() {
    return [
      { from: 'q_init', read: '—', write: '—', move: 'Seek LSB', to: 'q_add0', desc: 'Position all heads at rightmost bit' },
      { from: 'q_add0', read: '0, 0', write: '_, _, 0', move: 'L, L, L', to: 'q_add0', desc: '0+0=0, carry 0' },
      { from: 'q_add0', read: '0, 1', write: '_, _, 1', move: 'L, L, L', to: 'q_add0', desc: '0+1=1, carry 0' },
      { from: 'q_add0', read: '1, 0', write: '_, _, 1', move: 'L, L, L', to: 'q_add0', desc: '1+0=1, carry 0' },
      { from: 'q_add0', read: '1, 1', write: '_, _, 0', move: 'L, L, L', to: 'q_add1', desc: '1+1=10, write 0, carry 1' },
      { from: 'q_add0', read: 'B, B', write: '—', move: 'R, R, R', to: 'q_done', desc: 'Both exhausted, no carry' },
      { from: 'q_add1', read: '0, 0', write: '_, _, 1', move: 'L, L, L', to: 'q_add0', desc: '0+0+1=1, carry 0' },
      { from: 'q_add1', read: '0, 1', write: '_, _, 0', move: 'L, L, L', to: 'q_add1', desc: '0+1+1=10, write 0, carry 1' },
      { from: 'q_add1', read: '1, 0', write: '_, _, 0', move: 'L, L, L', to: 'q_add1', desc: '1+0+1=10, write 0, carry 1' },
      { from: 'q_add1', read: '1, 1', write: '_, _, 1', move: 'L, L, L', to: 'q_add1', desc: '1+1+1=11, write 1, carry 1' },
      { from: 'q_add1', read: 'B, B', write: '_, _, 1', move: 'R, R, R', to: 'q_done', desc: 'Exhausted, write final carry' },
      { from: 'q_done', read: '—', write: '—', move: '—', to: 'q_accept', desc: 'Clean up and halt' },
    ];
  }
}

/**
 * Utility: convert decimal to binary string
 */
export function decToBin(dec) {
  const n = parseInt(dec, 10);
  if (isNaN(n) || n < 0) return null;
  return n.toString(2);
}

/**
 * Utility: convert binary string to decimal
 */
export function binToDec(bin) {
  if (!/^[01]+$/.test(bin)) return null;
  return parseInt(bin, 2);
}
