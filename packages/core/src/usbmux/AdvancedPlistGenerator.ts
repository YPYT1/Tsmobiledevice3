/**
 * 高级 Plist 生成器 - 支持多种格式变体以适配不同 iTunes 版本
 */

export enum PlistFormat {
  /** 最简格式 - 仅包含必要字段 */
  MINIMAL = 'minimal',

  /** 标准格式 - 包含所有标准字段 */
  STANDARD = 'standard',

  /** Python 格式 - 模仿 pymobiledevice3 的 plistlib.dumps() */
  PYTHON_STYLE = 'python_style',

  /** Apple 原生格式 - 最严格的 Apple plist 格式 */
  APPLE_NATIVE = 'apple_native',

  /** 无 DOCTYPE 格式 - 简化的 XML */
  NO_DOCTYPE = 'no_doctype',

  /** 单行格式 - 无缩进的紧凑格式 */
  COMPACT = 'compact',
}

export class AdvancedPlistGenerator {
  /**
   * 根据指定格式生成 plist XML
   */
  static generate(data: Record<string, any>, format: PlistFormat = PlistFormat.STANDARD): string {
    switch (format) {
      case PlistFormat.MINIMAL:
        return this.generateMinimal(data);

      case PlistFormat.STANDARD:
        return this.generateStandard(data);

      case PlistFormat.PYTHON_STYLE:
        return this.generatePythonStyle(data);

      case PlistFormat.APPLE_NATIVE:
        return this.generateAppleNative(data);

      case PlistFormat.NO_DOCTYPE:
        return this.generateNoDoctype(data);

      case PlistFormat.COMPACT:
        return this.generateCompact(data);

      default:
        return this.generateStandard(data);
    }
  }

  /**
   * 最简格式 - 仅包含必要字段
   * 特点：无额外字段，最小化 XML
   */
  private static generateMinimal(data: Record<string, any>): string {
    const entries = this.buildEntries(data, '');
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${entries}
</dict>
</plist>`;
  }

  /**
   * 标准格式 - 包含所有标准字段
   * 特点：完整的 plist 结构，标准缩进
   */
  private static generateStandard(data: Record<string, any>): string {
    const entries = this.buildEntries(data, '  ');
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${entries}
</dict>
</plist>`;
  }

  /**
   * Python 格式 - 模仿 Python plistlib.dumps()
   * 特点：使用 Python plistlib 的缩进和格式风格
   */
  private static generatePythonStyle(data: Record<string, any>): string {
    const entries = this.buildEntries(data, '\t');
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${entries}
</dict>
</plist>`;
  }

  /**
   * Apple 原生格式 - 最严格的格式
   * 特点：符合 Apple 官方 plist 规范，使用特定缩进
   */
  private static generateAppleNative(data: Record<string, any>): string {
    const entries = this.buildEntries(data, '\t');
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${entries}
</dict>
</plist>`;
  }

  /**
   * 无 DOCTYPE 格式 - 简化的 XML
   * 特点：去掉 DOCTYPE 声明，某些旧版本 iTunes 可能需要
   */
  private static generateNoDoctype(data: Record<string, any>): string {
    const entries = this.buildEntries(data, '  ');
    return `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
${entries}
</dict>
</plist>`;
  }

  /**
   * 单行紧凑格式 - 无缩进
   * 特点：最小化传输数据量，可能绕过某些格式检查
   */
  private static generateCompact(data: Record<string, any>): string {
    const entries = this.buildEntriesCompact(data);
    return `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict>${entries}</dict></plist>`;
  }

  /**
   * 构建 dict entries（带缩进）
   */
  private static buildEntries(data: Record<string, any>, indent: string): string {
    const lines: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      lines.push(`${indent}<key>${this.escapeXml(key)}</key>`);
      lines.push(`${indent}${this.buildValue(value, indent)}`);
    }

    return lines.join('\n');
  }

  /**
   * 构建 dict entries（紧凑格式）
   */
  private static buildEntriesCompact(data: Record<string, any>): string {
    const parts: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      parts.push(`<key>${this.escapeXml(key)}</key>${this.buildValueCompact(value)}`);
    }

    return parts.join('');
  }

  /**
   * 构建单个 value（带缩进）
   */
  private static buildValue(value: any, indent: string): string {
    if (value === null || value === undefined) {
      return '<string></string>';
    }

    if (typeof value === 'string') {
      return `<string>${this.escapeXml(value)}</string>`;
    }

    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return `<integer>${value}</integer>`;
      } else {
        return `<real>${value}</real>`;
      }
    }

    if (typeof value === 'boolean') {
      return value ? '<true/>': '<false/>';
    }

    if (Buffer.isBuffer(value)) {
      return `<data>${value.toString('base64')}</data>`;
    }

    if (Array.isArray(value)) {
      const items = value.map(item =>
        `${indent}  ${this.buildValue(item, indent + '  ')}`
      ).join('\n');
      return `<array>\n${items}\n${indent}</array>`;
    }

    if (typeof value === 'object') {
      const entries = this.buildEntries(value, indent + '  ');
      return `<dict>\n${entries}\n${indent}</dict>`;
    }

    return `<string>${this.escapeXml(String(value))}</string>`;
  }

  /**
   * 构建单个 value（紧凑格式）
   */
  private static buildValueCompact(value: any): string {
    if (value === null || value === undefined) {
      return '<string></string>';
    }

    if (typeof value === 'string') {
      return `<string>${this.escapeXml(value)}</string>`;
    }

    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return `<integer>${value}</integer>`;
      } else {
        return `<real>${value}</real>`;
      }
    }

    if (typeof value === 'boolean') {
      return value ? '<true/>': '<false/>';
    }

    if (Buffer.isBuffer(value)) {
      return `<data>${value.toString('base64')}</data>`;
    }

    if (Array.isArray(value)) {
      const items = value.map(item => this.buildValueCompact(item)).join('');
      return `<array>${items}</array>`;
    }

    if (typeof value === 'object') {
      const entries = this.buildEntriesCompact(value);
      return `<dict>${entries}</dict>`;
    }

    return `<string>${this.escapeXml(String(value))}</string>`;
  }

  /**
   * XML 转义
   */
  private static escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * 添加标准客户端字段
   */
  static addClientFields(request: Record<string, any>, includeAll: boolean = true): Record<string, any> {
    if (includeAll) {
      return {
        ...request,
        ClientVersionString: 'qt4i-usbmuxd',
        ProgName: 'ts-mobiledevice',
        kLibUSBMuxVersion: 3,
      };
    } else {
      return request;
    }
  }
}