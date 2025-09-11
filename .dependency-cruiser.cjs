module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'No circular dependencies allowed',
      severity: 'error',
      from: {},
      to: {
        circular: true
      }
    },
    {
      name: 'no-cross-layer',
      comment: 'No dependencies from presentation layer to data layer',
      severity: 'error',
      from: {
        path: 'client/'
      },
      to: {
        path: 'server/'
      }
    },
    {
      name: 'no-test-imports-in-prod',
      comment: 'No test utilities in production code',
      severity: 'error',
      from: {
        pathNot: '\\.test\\.|tests/'
      },
      to: {
        path: 'tests/'
      }
    }
  ],
  options: {
    doNotFollow: {
      path: 'node_modules'
    },
    includeOnly: '^(client|server|shared|tests)/',
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json'
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default']
    }
  }
};