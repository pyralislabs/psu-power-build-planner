declare module "jsdom" {
  export class JSDOM {
    constructor(html: string, options?: { url?: string; pretendToBeVisual?: boolean });
    readonly window: {
      document: Document;
      HTMLElement: typeof HTMLElement;
      HTMLInputElement: typeof HTMLInputElement;
      HTMLLabelElement: typeof HTMLLabelElement;
      customElements: CustomElementRegistry;
      Blob: typeof Blob;
      FileReader: typeof FileReader;
      URL: typeof URL;
    };
  }
}
