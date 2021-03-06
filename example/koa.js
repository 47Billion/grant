
var fs = require('fs'),
  path = require('path')

var koa = require('koa'),
  router = require('koa-router'),
  mount = require('koa-mount'),
  bodyParser = require('koa-bodyparser'),
  koaqs = require('koa-qs'),
  session = require('koa-session'),
  accesslog = require('koa-accesslog')

var hogan = require('hogan.js'),
  extend = require('extend'),
  Grant = require('../index').koa()

var template = hogan.compile(fs.readFileSync(path.join(__dirname, 'template.html'),'utf8')),
  port = 3000


var config = {
  server: require('./config/server.json'),
  credentials: require('./config/credentials.json'),
  options: require('./config/options.json')
}

function transform (config) {
  var result = {server: config.server}
  for (var key in config.credentials) {
    var provider = {}
    extend(true, provider, config.credentials[key], config.options[key])
    result[key] = provider
  }
  return result
}


var grant = new Grant(transform(config))


var app = koa()
app.keys = ['secret','key']
app.use(accesslog())
app.use(mount(grant))
app.use(bodyParser())
app.use(session(app))
app.use(router(app))
koaqs(app)


// evernote sandbox urls
grant.config.evernote.request_url = grant.config.evernote.request_url.replace('www','sandbox')
grant.config.evernote.authorize_url = grant.config.evernote.authorize_url.replace('www','sandbox')
grant.config.evernote.access_url = grant.config.evernote.access_url.replace('www','sandbox')
// feedly sandbox urls
grant.config.feedly.authorize_url = grant.config.feedly.authorize_url.replace('cloud','sandbox')
grant.config.feedly.access_url = grant.config.feedly.access_url.replace('cloud','sandbox')


app.get('/', function *(next) {
  var session = this.session.grant||{}

  // feedly sandbox redirect_uri
  if (session.provider == 'feedly' && this.query.code) {
    var q = require('querystring')
    this.response.redirect('/connect/feedly/callback?'+q.stringify(this.query))
    return
  }

  console.log(this.query)

  var providers = Object.keys(grant.config)
  var params = []

  providers.forEach(function (provider) {
    var obj = {url:'/connect/'+provider, name:provider}
    if (session.provider == provider) {
      obj.credentials = this.query
      var key = this.query.error ? 'error' : 'raw'
      obj.credentials[key] = JSON.stringify(this.query[key], null, 4)
    }
    params.push(obj)
  }.bind(this))
  this.body = template.render({
    providers:params,
    count:providers.length-1//linkedin2
  })
})

app.listen(port, function() {
  console.log('Koa server listening on port ' + port)
})
