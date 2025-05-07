// A Docusaurus plugin to provide environment variables to the client

const envPlugin = function (context, options) {
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