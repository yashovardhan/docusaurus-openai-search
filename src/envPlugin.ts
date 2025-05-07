// A Docusaurus plugin to provide environment variables to the client
import type { LoadContext, PluginOptions } from '@docusaurus/types';

const envPlugin = function (context: LoadContext, options: PluginOptions) {
  return {
    name: "docusaurus-env-variables-plugin",
    injectHtmlTags() {
      return {
        headTags: [
          {
            tagName: "script",
            innerHTML: `window.OPENAI_API_KEY = "${process.env.OPENAI_API_KEY || ""}"`,
          },
        ],
      };
    },
  };
};

export default envPlugin; 