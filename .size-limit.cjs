module.exports = [
  {
    path: "dist/public/assets/index-*.js",
    limit: "350 KB",
    name: "Main JavaScript Bundle"
  },
  {
    path: "dist/public/assets/index-*.css", 
    limit: "100 KB",
    name: "CSS Bundle"
  }
];