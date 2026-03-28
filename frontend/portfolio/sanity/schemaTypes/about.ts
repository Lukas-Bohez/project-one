export const aboutSchema = {
  name: 'about',
  title: 'About',
  type: 'document',
  fields: [
    { name: 'tagline', title: 'Tagline', type: 'string' },
    { name: 'body', title: 'Body text', type: 'text' },
    { name: 'skills', title: 'Skills', type: 'array', of: [{ type: 'string' }] },
  ],
};
