const operators = {
  '+': { precedence: 1, apply: (a, b) => a + b },
  '-': { precedence: 1, apply: (a, b) => a - b },
  '*': { precedence: 2, apply: (a, b) => a * b },
  '/': { precedence: 2, apply: (a, b) => {
    if (b === 0) throw new Error('Tidak bisa membagi dengan nol.');
    return a / b;
  } },
  '^': { precedence: 3, apply: (a, b) => Math.pow(a, b) }
};

const functions = {
  'sin': (x, mode) => {
    const val = mode === 'deg' ? x * (Math.PI / 180) : x;
    return cleanFloat(Math.sin(val));
  },
  'cos': (x, mode) => {
    const val = mode === 'deg' ? x * (Math.PI / 180) : x;
    return cleanFloat(Math.cos(val));
  },
  'tan': (x, mode) => {
    const val = mode === 'deg' ? x * (Math.PI / 180) : x;
    const cosVal = cleanFloat(Math.cos(val));
    if (cosVal === 0) throw new Error('Tan tidak terdefinisi (pembagian dengan nol).');
    return cleanFloat(Math.tan(val));
  },
  'asin': (x, mode) => {
    if (x < -1 || x > 1) throw new Error('Input asin harus antara -1 dan 1.');
    const res = Math.asin(x);
    return mode === 'deg' ? res * (180 / Math.PI) : res;
  },
  'acos': (x, mode) => {
    if (x < -1 || x > 1) throw new Error('Input acos harus antara -1 dan 1.');
    const res = Math.acos(x);
    return mode === 'deg' ? res * (180 / Math.PI) : res;
  },
  'atan': (x, mode) => {
    const res = Math.atan(x);
    return mode === 'deg' ? res * (180 / Math.PI) : res;
  },
  'log': (x) => {
    if (x <= 0) throw new Error('Logaritma hanya untuk bilangan positif.');
    return Math.log10(x);
  },
  'ln': (x) => {
    if (x <= 0) throw new Error('Logaritma alami hanya untuk bilangan positif.');
    return Math.log(x);
  },
  'sqrt': (x) => {
    if (x < 0) throw new Error('Tidak bisa akar bilangan negatif.');
    return Math.sqrt(x);
  }
};

function cleanFloat(val) {
  if (Math.abs(val) < 1e-14) return 0;
  const rounded = Math.round(val);
  if (Math.abs(val - rounded) < 1e-14) return rounded;
  return val;
}

function factorial(n) {
  if (n < 0) throw new Error('Faktorial harus bilangan non-negatif.');
  if (!Number.isInteger(n)) throw new Error('Faktorial hanya untuk bilangan bulat.');
  if (n > 170) throw new Error('Hasil faktorial terlalu besar.');
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

export function evaluateExpression(input, mode = 'deg') {
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
        applyTopOperator(values, ops, mode);
      }
      if (ops.pop() !== '(') throw new Error('Tanda kurung tidak lengkap.');

      // Jika ada fungsi sebelum tanda kurung buka, evaluasi fungsinya sekarang
      if (ops.length && functions[ops.at(-1)]) {
        const funcName = ops.pop();
        const val = values.pop();
        if (val === undefined) throw new Error('Argumen fungsi tidak lengkap.');
        values.push(functions[funcName](val, mode));
      }
      continue;
    }

    // Postfix Operator: % (persen) dan ! (faktorial)
    // Diaplikasikan langsung ke nilai terakhir pada stack
    if (token === '%') {
      const val = values.pop();
      if (val === undefined) throw new Error('Perhitungan tidak lengkap.');
      values.push(val / 100);
      continue;
    }

    if (token === '!') {
      const val = values.pop();
      if (val === undefined) throw new Error('Perhitungan tidak lengkap.');
      values.push(factorial(val));
      continue;
    }

    // Fungsi Ilmiah
    if (functions[token]) {
      ops.push(token);
      continue;
    }

    // Operator Biner (+, -, *, /, ^)
    while (
      ops.length &&
      ops.at(-1) !== '(' &&
      !functions[ops.at(-1)] &&
      operators[ops.at(-1)].precedence >= operators[token].precedence
    ) {
      applyTopOperator(values, ops, mode);
    }
    ops.push(token);
  }

  while (ops.length) {
    if (ops.at(-1) === '(') throw new Error('Tanda kurung tidak lengkap.');
    applyTopOperator(values, ops, mode);
  }

  if (values.length !== 1 || !Number.isFinite(values[0])) {
    throw new Error('Perhitungan tidak valid.');
  }

  return formatResult(values[0]);
}

function normalizeExpression(input) {
  let expression = String(input)
    .replaceAll('×', '*')
    .replaceAll('÷', '/')
    .replaceAll('−', '-')
    .replaceAll(',', '.')
    .replace(/\s/g, '');

  return expression;
}

function tokenize(expression) {
  const tokens = [];
  let index = 0;
  let expectingNumber = true;

  while (index < expression.length) {
    const char = expression[index];
    const lastToken = tokens.length > 0 ? tokens[tokens.length - 1] : null;
    const isLastTokenValue = typeof lastToken === 'number' || lastToken === ')' || lastToken === '%' || lastToken === '!' || lastToken === Math.PI || lastToken === Math.E;

    if (char === '(') {
      if (isLastTokenValue) tokens.push('*');
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

    if (char === '%') {
      tokens.push('%');
      index += 1;
      expectingNumber = false;
      continue;
    }

    if (char === '!') {
      tokens.push('!');
      index += 1;
      expectingNumber = false;
      continue;
    }

    // Cek Fungsi Ilmiah
    let matchedFunc = null;
    const funcs = ['asin', 'acos', 'atan', 'sin', 'cos', 'tan', 'log', 'ln'];
    for (const f of funcs) {
      if (expression.startsWith(f, index)) {
        matchedFunc = f;
        break;
      }
    }
    if (char === '√') {
      matchedFunc = 'sqrt';
    }

    if (matchedFunc) {
      if (isLastTokenValue) tokens.push('*');
      tokens.push(matchedFunc);
      index += (char === '√' ? 1 : matchedFunc.length);
      expectingNumber = true;
      continue;
    }

    // Cek Konstanta Pi (π)
    if (char === 'π') {
      if (isLastTokenValue) tokens.push('*');
      tokens.push(Math.PI);
      index += 1;
      expectingNumber = false;
      continue;
    }

    // Cek Konstanta e
    // Hanya dicocokkan sebagai konstanta jika ia tidak diikuti huruf alfabet lain
    // (misal bukan bagian dari notasi ilmiah atau fungsi)
    if (char === 'e' && !/^[A-Za-z]/.test(expression.slice(index + 1))) {
      if (isLastTokenValue) tokens.push('*');
      tokens.push(Math.E);
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

    // Mencocokkan Angka (termasuk desimal dan notasi ilmiah 1e3, 2.5E-4, dll)
    const subStr = expression.slice(index);
    const numberRegex = expectingNumber
      ? /^-?\d+(?:\.\d*)?(?:[eE][-+]?\d+)?|^-?\.\d+(?:[eE][-+]?\d+)?/
      : /^\d+(?:\.\d*)?(?:[eE][-+]?\d+)?|^\.\d+(?:[eE][-+]?\d+)?/;

    const numberMatch = subStr.match(numberRegex);
    const rawNumber = numberMatch?.[0];

    if (!rawNumber || rawNumber === '-' || rawNumber === '.') {
      throw new Error('Format angka tidak valid.');
    }

    if (isLastTokenValue) tokens.push('*');

    tokens.push(Number(rawNumber));
    index += rawNumber.length;
    expectingNumber = false;
  }

  return tokens;
}

function isOperator(value) {
  return Object.hasOwn(operators, value);
}

function applyTopOperator(values, ops, mode) {
  const operator = ops.pop();
  
  if (functions[operator]) {
    const val = values.pop();
    if (val === undefined) throw new Error('Perhitungan tidak lengkap.');
    values.push(functions[operator](val, mode));
    return;
  }

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
