declare module "@formstr/sdk" {
  export class FormstrSDK {
    fetchForm(naddr: string, nkeys?: string): Promise<any>;
    fetchFormWithViewKey(naddr: string, viewKey: string): Promise<any>;
  }
}
