// Declare modules for Docusaurus imports
declare module '@docusaurus/Head';
declare module '@docusaurus/Link';
declare module '@docusaurus/router';
declare module '@docusaurus/Translate';
declare module '@docusaurus/useDocusaurusContext';
declare module '@docusaurus/theme-search-algolia/client';
declare module '@docusaurus/theme-common';

// CSS modules
declare module '*.css' {
  const classes: { [className: string]: string };
  export default classes;
}

// DocSearch modal modules
declare module '@docsearch/react/modal';
declare module '@docsearch/react/style'; 
declare module 'remark-admonitions'; 
declare module 'remark-directive'; 
