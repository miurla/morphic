const icons = require('iconoir-react')
const keys = Object.keys(icons)
const fs = require('fs')
fs.writeFileSync('iconoir-keys.txt', keys.join('\n'))
