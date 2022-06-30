const fs = require('fs')
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

const TAB_MAX_LIMIT = 30, BROWSER_COUNT = 1, BIO_SELECTOR = `div[data-testid="UserDescription"]`

let accounts = [], proxies = [], keywords = []

const loadFileAsString = (path) => {
  try {
    let data = fs.readFileSync(path)
    return data.toString().trim()
  } catch (e) {
    return null
  }
}

const loadData = (_accounts = "accounts.txt", _proxies = "proxies.txt", _keywords = "keywords.txt") => {
  console.log("loading accounts...")
  let data = loadFileAsString(_accounts)
  if (data) {
    accounts = data.split("\n")
    console.log(`[${accounts.length}] accounts loaded`)
  }
  console.log("loading proxies...")
  data = loadFileAsString(_proxies)
  if (data) {
    let str_proxies = data.split("\n")
    for (let sp of str_proxies) {
      let [host, port, user, pass] = sp.split(":")
      if (host && port && user && pass) {
        proxies.push({
          host, port, user, pass
        })
        console.log(`[${proxies.length}] proxies loaded`)
      }
    }
  }
  console.log("loading keywords...")
  data = loadFileAsString(_keywords)
  if (data) {
    keywords = data.split("\n")
    console.log(`[${keywords.length}] keywords loaded`)
  }
}

const hasAnyKeywords = (bio) => {
  for (let keyword of keywords) {
    if (bio.indexOf(keyword.toLowerCase()) > -1) {
      return true
    }
  }
  return false
}

const procOne = async (browser, proxy, screen_name, is_last) => {
  let page = await browser.newPage()
  try {
    if (proxy) {
      await page.authenticate({
        username: proxy.user,
        password: proxy.pass
      })
    }
    await page.goto(`https://twitter.com/${screen_name}`, {waitUntil: "networkidle2", timeout: 0})
    // await page.waitForSelector(BIO_SELECTOR)
    let bio = await page.evaluate((selector) => {
      let desc = document.querySelector(selector)
      if (desc) {
        return desc.innerText
      }
      return null
    }, BIO_SELECTOR)
    if (bio) {
      console.log(`[${screen_name}] => ${bio}`)
      if (hasAnyKeywords(bio.toString().toLowerCase())) {
        // result_names.push(screen_name)
        fs.appendFileSync("result.txt", `${screen_name}\n`)
      }
    } else {
      console.log(`[${screen_name}] => (no bio)`)
    }
  } catch (e) {
    console.log(`[${screen_name}] => (-)`)
  } finally {
    page.close()
    if (is_last) {
      browser.close()
    }
  }
}

const procByGroup = async (browser, proxy, screen_names, browser_index = 1) => {
  let idx_name = 0;
  while (idx_name < screen_names.length) {
    let current_tab_count = (await browser.pages()).length
    let available_tab_count = TAB_MAX_LIMIT - current_tab_count
    for (let idx_tab = 0; idx_tab < available_tab_count; idx_tab++) {
      // console.log(`Browser[${browser_index}] => Checking [${idx_name + idx_tab}]th account`)
      procOne(browser, proxy, screen_names[idx_name + idx_tab], idx_name === screen_names.length - 1)
    }
    idx_name += available_tab_count
    await sleep(1000)
  }
}

const sleep = async (ms) => {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

const getRandomProxy = () => {
  if (proxies.length > 0) {
    let idx = Math.floor(Math.random() * proxies.length)
    return proxies[idx]
  }
  return null
}

const start = () => {
  loadData()

  let ACCOUNT_PER_BROWSER = Math.ceil(accounts.length / BROWSER_COUNT)

  for (let i = 0; i < BROWSER_COUNT; i++) {
    let proxy = getRandomProxy()
    let account_group = accounts.slice(i * ACCOUNT_PER_BROWSER, (i + 1) * ACCOUNT_PER_BROWSER)

    let options = {
      headless: false,
      args: []
    }

    if (proxy) {
      options.args.push(`--proxy-server=http://${proxy.host}:${proxy.port}`)
    }
    puppeteer.launch(options).then(async browser => {
      // procByGroup(browser, proxy, account_group, i)
    })
  }
}

start()