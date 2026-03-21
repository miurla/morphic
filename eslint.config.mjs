import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import simpleImportSort from 'eslint-plugin-simple-import-sort'

const importSortGroups = [
  ['^react', '^next'],
  ['^@?\\w'],
  ['^@/types'],
  ['^@/config'],
  ['^@/lib'],
  ['^@/hooks'],
  ['^@/components/ui'],
  ['^@/components'],
  ['^@/registry'],
  ['^@/styles'],
  ['^@/app'],
  ['^\\u0000'],
  ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
  ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
  ['^.+\\.s?css$']
]

export default defineConfig([
  ...nextVitals,
  {
    plugins: {
      'simple-import-sort': simpleImportSort
    },
    rules: {
      'simple-import-sort/imports': [
        'error',
        {
          groups: importSortGroups
        }
      ],
      'simple-import-sort/exports': 'error'
    }
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts'])
])
