export const projectSchema = {
  name: 'project',
  title: 'Project',
  type: 'document',
  fields: [
    { name: 'title', title: 'Title', type: 'string' },
    { name: 'description', title: 'Description', type: 'text' },
    { name: 'impactLine', title: 'Impact line', type: 'string' },
    { name: 'githubUrl', title: 'GitHub URL', type: 'url' },
    {
      name: 'thumbnail',
      title: 'Thumbnail',
      type: 'image',
      options: { hotspot: true },
      fields: [{ name: 'alt', type: 'string', title: 'Alt text' }],
    },
    { name: 'order', title: 'Display order', type: 'number' },
  ],
};
