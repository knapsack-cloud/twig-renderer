export interface TwigRendererConfig {
  src: {
    /** Root directories for Twig Loader */
    roots: string[];
    namespaces?: {
      id: string;
      recursive?: boolean;
      paths: string[];
    }[]
  };
  relativeFrom?: string;
  alterTwigEnv?: {
    file: string;
    functions: string[];
  }[];
  hasExtraInfoInResponses?: boolean;
  autoescape?: boolean;
  debug?: boolean;
  verbose?: boolean;
  keepAlive?: boolean;
  maxConcurrency?: number;
}

declare class TwigRenderer {
  inProgressRequests: number;
  totalRequests: number;
  completedRequests: number;
  config: TwigRendererConfig;
  constructor(userConfig: TwigRendererConfig);
  render: (template: string, data?: object) => Promise<{
    ok: boolean,
    html: string,
    message: string,
  }>;
  renderString: (template: string, data?: object) => Promise<{
    ok: boolean,
    html: string,
    message: string,
  }>;
  getMeta: () => Promise<object>;
}

// declare namespace TwigRenderer {
//   export
//
// }

export default TwigRenderer;
