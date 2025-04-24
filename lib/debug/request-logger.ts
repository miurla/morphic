// lib/debug/request-logger.ts
if (process.env.NODE_ENV === 'development' && typeof window === 'undefined') {
    const originalFetch = globalThis.fetch;
  
    globalThis.fetch = async (input: RequestInfo, init?: RequestInit) => {
      const res = await originalFetch(input, init);
  
      // log only the RITS calls to avoid noise
      if (typeof input === 'string' &&
          input.includes('inference-3scale-apicast-production')) {
        console.log('🚚  RITS fetch =>', input);
        console.log('      headers :', init?.headers);
        console.log('      status  :', res.status, res.statusText);
      }
      return res;
    };
  }
  