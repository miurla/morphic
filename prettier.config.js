/** @type {import('prettier').Config} */
module.exports = {
  endOfLine: 'lf',
  semi: false,
  useTabs: false,
  singleQuote: true,
  arrowParens: 'avoid',
  plugins: ['prettier-plugin-sql'],
  language: 'postgresql',
  tabWidth: 2,
  trailingComma: 'none'
}
