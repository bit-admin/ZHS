interface StealthOptions {
  chromeVersion: string
  platform: string
  languages: string[]
}

export function buildStealthScript(options: StealthOptions): string {
  return `;(${mainWorldStealth.toString()})(${JSON.stringify(options)});`
}

function mainWorldStealth(options: StealthOptions): void {
  const nativeStrings = new WeakMap<Function, string>()
  const originalToString = Function.prototype.toString
  const nativeToString = originalToString.call(originalToString)

  const makeNativeString = (name: string): string => nativeToString.replace('toString', name)
  const markNative = (fn: Function, name: string): void => {
    nativeStrings.set(fn, makeNativeString(name))
  }

  const toStringProxy = new Proxy(originalToString, {
    apply(target, thisArg, argArray) {
      if (typeof thisArg === 'function' && nativeStrings.has(thisArg)) {
        return nativeStrings.get(thisArg)
      }
      return Reflect.apply(target, thisArg, argArray)
    }
  })
  markNative(toStringProxy, 'toString')
  Object.defineProperty(Function.prototype, 'toString', {
    value: toStringProxy,
    configurable: true,
    writable: true
  })

  const replaceGetter = <T extends object>(
    target: T,
    property: PropertyKey,
    getter: () => unknown,
    nativeName = `get ${String(property)}`
  ): void => {
    markNative(getter, nativeName)
    Object.defineProperty(target, property, {
      get: getter,
      configurable: true
    })
  }

  replaceGetter(Navigator.prototype, 'webdriver', () => undefined)
  replaceGetter(Navigator.prototype, 'languages', () => options.languages.slice())
  replaceGetter(Navigator.prototype, 'platform', () => 'Win32')

  const makeMimeType = (type: string, suffixes: string, description: string, pluginName: string) => ({
    type,
    suffixes,
    description,
    enabledPlugin: null as unknown
  })

  const pluginSpecs = [
    {
      name: 'PDF Viewer',
      filename: 'internal-pdf-viewer',
      description: 'Portable Document Format',
      mimeTypes: [makeMimeType('application/pdf', 'pdf', 'Portable Document Format', 'PDF Viewer')]
    },
    {
      name: 'Chrome PDF Viewer',
      filename: 'internal-pdf-viewer',
      description: 'Portable Document Format',
      mimeTypes: [makeMimeType('application/pdf', 'pdf', 'Portable Document Format', 'Chrome PDF Viewer')]
    },
    {
      name: 'Chromium PDF Viewer',
      filename: 'internal-pdf-viewer',
      description: 'Portable Document Format',
      mimeTypes: [
        makeMimeType('application/x-google-chrome-pdf', 'pdf', 'Portable Document Format', 'Chromium PDF Viewer')
      ]
    },
    {
      name: 'Microsoft Edge PDF Viewer',
      filename: 'internal-pdf-viewer',
      description: 'Portable Document Format',
      mimeTypes: [
        makeMimeType('application/x-google-chrome-pdf', 'pdf', 'Portable Document Format', 'Microsoft Edge PDF Viewer')
      ]
    },
    {
      name: 'WebKit built-in PDF',
      filename: 'internal-pdf-viewer',
      description: 'Portable Document Format',
      mimeTypes: [makeMimeType('application/pdf', 'pdf', 'Portable Document Format', 'WebKit built-in PDF')]
    }
  ]

  const makePluginArray = () => {
    const plugins = pluginSpecs.map((spec) => {
      const plugin = {
        0: spec.mimeTypes[0],
        name: spec.name,
        filename: spec.filename,
        description: spec.description,
        length: spec.mimeTypes.length,
        item(index: number) {
          return spec.mimeTypes[index] || null
        },
        namedItem(name: string) {
          return spec.mimeTypes.find((mimeType) => mimeType.type === name) || null
        }
      }
      Object.defineProperty(plugin, spec.mimeTypes[0].type, {
        value: spec.mimeTypes[0],
        enumerable: false
      })
      spec.mimeTypes[0].enabledPlugin = plugin
      return plugin
    })

    const pluginArray = {
      length: plugins.length,
      item(index: number) {
        return plugins[index] || null
      },
      namedItem(name: string) {
        return plugins.find((plugin) => plugin.name === name) || null
      },
      refresh() {}
    }

    plugins.forEach((plugin, index) => {
      Object.defineProperty(pluginArray, index, { value: plugin, enumerable: false })
      Object.defineProperty(pluginArray, plugin.name, { value: plugin, enumerable: false })
    })

    markNative(pluginArray.item, 'item')
    markNative(pluginArray.namedItem, 'namedItem')
    markNative(pluginArray.refresh, 'refresh')
    return pluginArray
  }

  const makeMimeTypeArray = () => {
    const mimeTypes = pluginSpecs.flatMap((spec) => spec.mimeTypes)
    const mimeTypeArray = {
      length: mimeTypes.length,
      item(index: number) {
        return mimeTypes[index] || null
      },
      namedItem(type: string) {
        return mimeTypes.find((mimeType) => mimeType.type === type) || null
      }
    }

    mimeTypes.forEach((mimeType, index) => {
      Object.defineProperty(mimeTypeArray, index, { value: mimeType, enumerable: false })
      Object.defineProperty(mimeTypeArray, mimeType.type, { value: mimeType, enumerable: false })
    })

    markNative(mimeTypeArray.item, 'item')
    markNative(mimeTypeArray.namedItem, 'namedItem')
    return mimeTypeArray
  }

  const plugins = makePluginArray()
  const mimeTypes = makeMimeTypeArray()
  replaceGetter(Navigator.prototype, 'plugins', () => plugins)
  replaceGetter(Navigator.prototype, 'mimeTypes', () => mimeTypes)

  const navProto = Navigator.prototype as Navigator & {
    userAgentData?: unknown
  }
  if ('userAgentData' in navigator || 'userAgentData' in navProto) {
    const brands = [
      { brand: 'Chromium', version: options.chromeVersion.split('.')[0] },
      { brand: 'Google Chrome', version: options.chromeVersion.split('.')[0] },
      { brand: 'Not:A-Brand', version: '99' }
    ]
    replaceGetter(navProto, 'userAgentData', () => ({
      brands,
      mobile: false,
      platform: options.platform,
      getHighEntropyValues: async (hints: string[]) => {
        const values: Record<string, unknown> = {
          brands,
          mobile: false,
          platform: options.platform,
          architecture: options.platform === 'Windows' ? 'x86' : 'arm',
          bitness: '64',
          model: '',
          platformVersion: options.platform === 'Windows' ? '10.0.0' : '14.0.0',
          uaFullVersion: options.chromeVersion,
          fullVersionList: brands.map((brand) => ({ ...brand, version: options.chromeVersion }))
        }
        return hints.reduce<Record<string, unknown>>(
          (result, hint) => {
            if (hint in values) {
              result[hint] = values[hint]
            }
            return result
          },
          { brands, mobile: false, platform: options.platform }
        )
      }
    }))
  }

  const chromeWindow = window as Window & { chrome?: Record<string, unknown> }
  const chromeObject = (chromeWindow.chrome ||= {})
  chromeObject.runtime ||= {
    PlatformOs: {
      MAC: 'mac',
      WIN: 'win',
      ANDROID: 'android',
      CROS: 'cros',
      LINUX: 'linux',
      OPENBSD: 'openbsd'
    },
    PlatformArch: {
      ARM: 'arm',
      ARM64: 'arm64',
      X86_32: 'x86-32',
      X86_64: 'x86-64'
    },
    PlatformNaclArch: {
      ARM: 'arm',
      X86_32: 'x86-32',
      X86_64: 'x86-64'
    },
    RequestUpdateCheckStatus: {
      THROTTLED: 'throttled',
      NO_UPDATE: 'no_update',
      UPDATE_AVAILABLE: 'update_available'
    },
    OnInstalledReason: {
      INSTALL: 'install',
      UPDATE: 'update',
      CHROME_UPDATE: 'chrome_update',
      SHARED_MODULE_UPDATE: 'shared_module_update'
    },
    OnRestartRequiredReason: {
      APP_UPDATE: 'app_update',
      OS_UPDATE: 'os_update',
      PERIODIC: 'periodic'
    }
  }

  if (navigator.permissions?.query) {
    const originalQuery = navigator.permissions.query.bind(navigator.permissions)
    const query = (parameters: PermissionDescriptor) => {
      if (parameters && parameters.name === 'notifications') {
        return Promise.resolve({ state: Notification.permission, onchange: null } as PermissionStatus)
      }
      return originalQuery(parameters)
    }
    markNative(query, 'query')
    Object.defineProperty(navigator.permissions, 'query', {
      value: query,
      configurable: true,
      writable: true
    })
  }

  const patchWebGL = (prototype: WebGLRenderingContext | WebGL2RenderingContext): void => {
    const originalGetParameter = prototype.getParameter
    const getParameter = function (this: WebGLRenderingContext | WebGL2RenderingContext, parameter: number) {
      if (parameter === 37445) {
        return 'Google Inc. (Apple)'
      }
      if (parameter === 37446) {
        return 'ANGLE (Apple, Apple M1, OpenGL 4.1)'
      }
      return originalGetParameter.call(this, parameter)
    }
    markNative(getParameter, 'getParameter')
    Object.defineProperty(prototype, 'getParameter', {
      value: getParameter,
      configurable: true,
      writable: true
    })
  }

  if (window.WebGLRenderingContext) {
    patchWebGL(WebGLRenderingContext.prototype)
  }
  if (window.WebGL2RenderingContext) {
    patchWebGL(WebGL2RenderingContext.prototype)
  }

  const contentWindowDescriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow')
  if (contentWindowDescriptor?.get) {
    const originalGetter = contentWindowDescriptor.get
    const getter = function (this: HTMLIFrameElement) {
      const contentWindow = originalGetter.call(this)
      if (!contentWindow) {
        return contentWindow
      }
      return new Proxy(contentWindow, {
        get(target, property, receiver) {
          if (property === 'self') {
            return target
          }
          if (property === 'frameElement') {
            return this
          }
          return Reflect.get(target, property, receiver)
        }
      })
    }
    replaceGetter(HTMLIFrameElement.prototype, 'contentWindow', getter)
  }
}
