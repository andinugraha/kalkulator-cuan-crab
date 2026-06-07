const operators = {
  '+': { precedence: 1, apply: (a, b) => a + b },
  '-': { precedence: 1, apply: (a, b) => a - b },
  '*': { precedence: 2, apply: (a, b) => a * b },
  '/': { precedence: 2, apply: (a, b) => {
    if (b === 0) throw new Error('Tidak bisa membagi dengan nol.');
    return a / b;
  } }
};

export function evaluateExpression(input) {
  const expression = normalizeExpression(input);
  const tokens = tokenize(expression);
  const values = [];
  const ops = [];

  for (const token of tokens) {
    if (typeof token === 'number') {
      values.push(token);
      continue;
    }

    if (token === '(') {
      ops.push(token);
      continue;
    }

    if (token === ')') {
      while (ops.length && ops.at(-1) !== '(') {
        applyTopOperator(values, ops);
      }
      if (ops.pop() !== '(') throw new Error('Tanda kurung tidak lengkap.');
      continue;
    }

    while (
      ops.length &&
      ops.at(-1) !== '(' &&
      operators[ops.at(-1)].precedence >= operators[token].precedence
    ) {
      applyTopOperator(values, ops);
    }
    ops.push(token);
  }

  while (ops.length) {
    if (ops.at(-1) === '(') throw new Error('Tanda kurung tidak lengkap.');
    applyTopOperator(values, ops);
  }

  if (values.length !== 1 || !Number.isFinite(values[0])) {
    throw new Error('Perhitungan tidak valid.');
  }

  return formatResult(values[0]);
}

function normalizeExpression(input) {
  const expression = String(input)
    .replaceAll('×', '*')
    .replaceAll('÷', '/')
    .replaceAll(',', '.')
    .replace(/\s/g, '');

  if (!/^[\d+\-*/().]+$/.test(expression)) {
    throw new Error('Gunakan angka dan operator kalkulator saja.');
  }

  return expression;
}

function tokenize(expression) {
  const tokens = [];
  let index = 0;
  let expectingNumber = true;

  while (index < expression.length) {
    const char = expression[index];

    if (char === '(') {
      tokens.push(char);
      index += 1;
      expectingNumber = true;
      continue;
    }

    if (char === ')') {
      tokens.push(char);
      index += 1;
      expectingNumber = false;
      continue;
    }

    if (isOperator(char) && !(char === '-' && expectingNumber)) {
      tokens.push(char);
      index += 1;
      expectingNumber = true;
      continue;
    }

    const numberMatch = expression.slice(index).match(/^-?\d*(?:\.\d*)?/);
    const rawNumber = numberMatch?.[0];

    if (!rawNumber || rawNumber === '-' || rawNumber === '.') {
      throw new Error('Format angka tidak valid.');
    }

    tokens.push(Number(rawNumber));
    index += rawNumber.length;
    expectingNumber = false;
  }

  return tokens;
}

function isOperator(value) {
  return Object.hasOwn(operators, value);
}

function applyTopOperator(values, ops) {
  const operator = ops.pop();
  const b = values.pop();
  const a = values.pop();

  if (a === undefined || b === undefined) {
    throw new Error('Perhitungan tidak lengkap.');
  }

  values.push(operators[operator].apply(a, b));
}

function formatResult(value) {
  const rounded = Number(value.toPrecision(12));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}
