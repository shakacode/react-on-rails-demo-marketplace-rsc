declare module '@loadable/component' {
  import type { ComponentType, ReactNode } from 'react';

  interface LoadableOptions<Props extends object, Module> {
    fallback?: ReactNode;
    ssr?: boolean;
    cacheKey?: (props: Props) => unknown;
    resolveComponent?: (module: Module, props: Props) => ComponentType<Props>;
  }

  type LoadableComponent<Props extends object> = ComponentType<Props> & {
    load(props?: Props): Promise<ComponentType<Props>>;
    preload(props?: Props): void;
  };

  type PropsOf<Module> = Module extends { default: ComponentType<infer Props> }
    ? Props extends object
      ? Props
      : Record<string, never>
    : Record<string, never>;

  interface LoadableReadyOptions {
    chunkLoadingGlobal?: string;
    namespace?: string;
  }

  export default function loadable<Module extends { default: ComponentType<any> }>(
    loader: () => Promise<Module>,
    options?: LoadableOptions<PropsOf<Module>, Module>
  ): LoadableComponent<PropsOf<Module>>;

  export default function loadable<Props extends object = Record<string, never>, Module = { default: ComponentType<Props> }>(
    loader: (props: Props) => Promise<Module>,
    options?: LoadableOptions<Props, Module>
  ): LoadableComponent<Props>;

  export function loadableReady(done?: () => void, options?: LoadableReadyOptions): Promise<void>;
}

declare module '@loadable/server' {
  import type { ReactElement } from 'react';

  type ChunkExtractorOptions = {
    entrypoints?: string | string[];
    inputFileSystem?: object;
    namespace?: string;
    outputPath?: string;
    publicPath?: string;
  } & ({ statsFile: string } | { stats: object });

  export class ChunkExtractor {
    constructor(options: ChunkExtractorOptions);
    collectChunks(element: ReactElement): ReactElement;
    getLinkTags(): string;
    getScriptTags(): string;
    getStyleTags(): string;
  }
}
