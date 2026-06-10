#!/usr/bin/env tsx

import { Project, SyntaxKind, Node, StringLiteral, JsxAttribute, JsxText } from 'ts-morph';
import { globSync } from 'fast-glob';
import { kebabCase } from 'change-case';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import stringify from 'json-stable-stringify';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load mapping configuration
const mappingConfig: { [namespace: string]: { [text: string]: string } } = JSON.parse(fs.readFileSync(path.join(__dirname, 'i18n-mapping.json'), 'utf-8'));

// Component to namespace mapping
const componentNamespaces = {
  'header': 'header',
  'home': 'home', 
  'product-details': 'product'
};

interface ExtractedString {
  value: string;
  namespace: string;
  key: string;
  interpolations?: { [key: string]: string };
}

interface LocaleFiles {
  [locale: string]: {
    [namespace: string]: any;
  };
}

class I18nExtractor {
  private project: Project;
  private localeFiles: LocaleFiles = {};
  private extractedStrings: ExtractedString[] = [];

  constructor() {
    this.project = new Project({
      tsConfigFilePath: path.join(process.cwd(), 'tsconfig.json'),
    });
    this.loadLocaleFiles();
  }

  private loadLocaleFiles() {
    const localeDir = path.join(process.cwd(), 'client/src/locales');
    const locales = ['lv', 'en'];
    
    for (const locale of locales) {
      this.localeFiles[locale] = {};
      const localePath = path.join(localeDir, locale);
      
      if (fs.existsSync(localePath)) {
        const namespaceFiles = fs.readdirSync(localePath).filter(f => f.endsWith('.json'));
        
        for (const file of namespaceFiles) {
          const namespace = path.basename(file, '.json');
          const filePath = path.join(localePath, file);
          this.localeFiles[locale][namespace] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
      }
    }
  }

  private getComponentNamespace(filePath: string): string {
    const fileName = path.basename(filePath, '.tsx').toLowerCase();
    return componentNamespaces[fileName] || 'common';
  }

  private findExistingKey(value: string): { namespace: string; key: string } | null {
    // First check mapping config
    for (const [namespace, mappings] of Object.entries(mappingConfig)) {
      if (mappings && typeof mappings === 'object' && mappings[value]) {
        return { namespace, key: mappings[value] };
      }
    }

    // Then check existing locale files
    for (const [locale, namespaces] of Object.entries(this.localeFiles)) {
      for (const [namespace, translations] of Object.entries(namespaces)) {
        const key = this.findKeyByValue(translations, value);
        if (key) {
          return { namespace, key };
        }
      }
    }

    return null;
  }

  private findKeyByValue(obj: any, value: string, prefix = ''): string | null {
    for (const [key, val] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof val === 'string' && val === value) {
        return fullKey;
      } else if (typeof val === 'object' && val !== null) {
        const found = this.findKeyByValue(val, value, fullKey);
        if (found) return found;
      }
    }
    return null;
  }

  private generateKey(value: string, namespace: string): string {
    // Generate a key from the value
    const sanitized = value
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .toLowerCase();
    
    const key = kebabCase(sanitized).replace(/-+/g, '.');
    
    // Ensure uniqueness
    let finalKey = key;
    let counter = 1;
    while (this.keyExists(namespace, finalKey)) {
      finalKey = `${key}${counter}`;
      counter++;
    }
    
    return finalKey;
  }

  private keyExists(namespace: string, key: string): boolean {
    for (const locale of Object.keys(this.localeFiles)) {
      if (this.localeFiles[locale][namespace]) {
        const keyParts = key.split('.');
        let current = this.localeFiles[locale][namespace];
        
        for (const part of keyParts) {
          if (current && typeof current === 'object' && part in current) {
            current = current[part];
          } else {
            return false;
          }
        }
        
        if (typeof current === 'string') {
          return true;
        }
      }
    }
    return false;
  }

  private processStringLiteral(node: StringLiteral, filePath: string): void {
    const value = node.getLiteralValue();
    
    // Skip empty strings, very short strings, or strings that look like code
    if (!value || value.length < 3 || /^[a-z]+$/.test(value) || /^\d+$/.test(value)) {
      return;
    }

    // Skip if it's already a translation key pattern
    if (/^[a-z]+:[a-z.]+$/i.test(value)) {
      return;
    }

    const namespace = this.getComponentNamespace(filePath);
    const existingKey = this.findExistingKey(value);
    
    let targetNamespace: string;
    let key: string;
    
    if (existingKey) {
      targetNamespace = existingKey.namespace;
      key = existingKey.key;
    } else {
      targetNamespace = namespace;
      key = this.generateKey(value, namespace);
    }

    // Replace the string literal with t() call
    const fullKey = `${targetNamespace}:${key}`;
    node.replaceWithText(`t('${fullKey}')`);

    this.extractedStrings.push({
      value,
      namespace: targetNamespace,
      key,
    });
  }

  private ensureUseTranslation(sourceFile: any): void {
    const existingImport = sourceFile.getImportDeclaration((decl) =>
      decl.getModuleSpecifierValue() === 'react-i18next'
    );

    if (!existingImport) {
      sourceFile.addImportDeclaration({
        moduleSpecifier: 'react-i18next',
        namedImports: ['useTranslation'],
      });
    } else {
      const namedImports = existingImport.getNamedImports();
      const hasUseTranslation = namedImports.some(imp => imp.getName() === 'useTranslation');
      
      if (!hasUseTranslation) {
        existingImport.addNamedImport('useTranslation');
      }
    }

    // Find the main component function and add useTranslation hook
    const functionDeclarations = sourceFile.getFunctions();
    const arrowFunctions = sourceFile.getVariableDeclarations().filter(decl => 
      decl.getInitializer()?.getKind() === SyntaxKind.ArrowFunction
    );

    let targetFunction = functionDeclarations[0] || arrowFunctions[0];
    
    if (targetFunction) {
      const body = targetFunction.getBody ? targetFunction.getBody() : 
                   targetFunction.getInitializer()?.getBody?.();
      
      if (body && body.getKind() === SyntaxKind.Block) {
        const statements = body.getStatements();
        const hasUseTranslation = statements.some(stmt => 
          stmt.getText().includes('useTranslation(')
        );

        if (!hasUseTranslation) {
          body.insertStatement(0, "const { t } = useTranslation();");
        }
      }
    }
  }

  private processFile(filePath: string): void {
    console.log(`Processing ${filePath}...`);
    
    const sourceFile = this.project.addSourceFileAtPath(filePath);
    
    // Process JSX text nodes
    sourceFile.getDescendantsOfKind(SyntaxKind.JsxText).forEach(node => {
      const text = node.getText().trim();
      if (text && text.length > 2) {
        const literal = node.replaceWithText(`{t('placeholder')}`);
        // We'll replace this properly in the next pass
      }
    });

    // Process string literals in JSX attributes and other contexts
    sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).forEach(node => {
      this.processStringLiteral(node, filePath);
    });

    this.ensureUseTranslation(sourceFile);
    
    sourceFile.saveSync();
  }

  private updateLocaleFiles(): void {
    // Group extracted strings by namespace
    const byNamespace: { [namespace: string]: { [key: string]: string } } = {};
    
    for (const extracted of this.extractedStrings) {
      if (!byNamespace[extracted.namespace]) {
        byNamespace[extracted.namespace] = {};
      }
      byNamespace[extracted.namespace][extracted.key] = extracted.value;
    }

    // Update locale files
    for (const [namespace, newKeys] of Object.entries(byNamespace)) {
      for (const locale of ['lv', 'en']) {
        if (!this.localeFiles[locale][namespace]) {
          this.localeFiles[locale][namespace] = {};
        }

        // Merge new keys
        const merged = { ...this.localeFiles[locale][namespace] };
        for (const [key, value] of Object.entries(newKeys)) {
          if (!this.getNestedValue(merged, key)) {
            this.setNestedValue(merged, key, locale === 'lv' ? value : `[EN] ${value}`);
          }
        }

        // Write updated file
        const filePath = path.join(process.cwd(), `client/src/locales/${locale}/${namespace}.json`);
        fs.writeFileSync(filePath, stringify(merged, { space: 2 }) + '\n');
      }
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    
    let current = obj;
    for (const key of keys) {
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[lastKey] = value;
  }

  public run(): void {
    const targetFiles = [
      'client/src/components/layout/header.tsx',
      'client/src/pages/home.tsx', 
      'client/src/pages/product-details.tsx'
    ];

    console.log('Starting i18n extraction and replacement...');
    
    for (const file of targetFiles) {
      if (fs.existsSync(file)) {
        this.processFile(file);
      } else {
        console.warn(`File not found: ${file}`);
      }
    }

    this.updateLocaleFiles();
    
    console.log(`Extracted ${this.extractedStrings.length} strings`);
    console.log('Updated locale files');
    console.log('Done!');
  }
}

// Run the extractor
const extractor = new I18nExtractor();
extractor.run();