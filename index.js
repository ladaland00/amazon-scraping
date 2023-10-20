const puppeteer = require('puppeteer');
const fs = require("fs");
(async () => {
    // Launch the browser and open a new blank page
    const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
    const page = await browser.newPage();
    const searchPhrase = "box";
    const scrapeToPage = 3;
    const homeUrl = "https://www.amazon.com/gp/cart/view.html"
    // Navigate the page to a URL
    await page.goto(homeUrl);

    // Set screen size
    await page.waitForSelector('#twotabsearchtextbox')
    // Type into search box
    await page.type('#twotabsearchtextbox', searchPhrase);
    await page.click("#nav-search-submit-button");

    // Wait page search load
    await page.waitForSelector(
        '.s-result-list'
    );
    //  get after search url
    const url = page.url();
    const cardData = []

    async function scrapePage(url, currentPage = 1, scrapeToPage = null) {
        console.log("Scraping page " + currentPage + "...");
        if (scrapeToPage !== null && currentPage > scrapeToPage) {
            return // limit scrap page
        }
        await page.goto(url)

        // wait selector
        await page.waitForSelector(
            '.s-result-item'
        );
        const pageCardData = await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll(".s-result-item"))
            console.log("cards", cards)
            const cardInfo = cards.map(card => {
                const productName = card.querySelector("h2")?.textContent.trim();

                const sponsorTag = card.querySelector(".puis-sponsored-label-text");
                const sponsored = sponsorTag ? "yes" : "no";

                const badgeElement = card.querySelector("span.a-badge-label-inner")
                const badge = badgeElement ? badgeElement.textContent : "N/A"

                const priceElement = card.querySelector('.a-price .a-offscreen')
                const price = priceElement ? priceElement.textContent : "N/A"

                const basePriceElement = card.querySelector('span.a-price .a-offscreen')
                const basePrice = basePriceElement ? basePriceElement.textContent : "N/A"

                const ratingElement = card.querySelector('.a-row > span:nth-child(1)[aria-label]')
                const decimalRegex = /^\d+([,.]\d+)?$/
                const ariaLabel = ratingElement ? ratingElement.getAttribute('aria-label') : "N/A"
                const firstThreeCharacters = ariaLabel.substring(0, 3)
                const rating = decimalRegex.test(firstThreeCharacters) ? firstThreeCharacters.replace(',', '.') : "N/A"

                const ratingNumberElement = card.querySelector('.a-row > span:nth-child(2)[aria-label]')
                const numberRegex = /^-?\d(\.\d+)?$/
                const numberFormatted = ratingNumberElement ? ratingNumberElement.getAttribute('aria-label').replace('/[\s.,]+/', '') : "N/A"
                const ratingNumber = numberRegex.test(numberFormatted) ? numberFormatted : "N/A"

                const boughtPastMonthElement = card.querySelector('.a-row.a-size-base > .a-size-base.a-color-secondary')
                const textContent = boughtPastMonthElement ? boughtPastMonthElement.textContent : "N/A"

                const plusSignRegex = /\b.*?\+/
                const plusSignText = textContent.match(plusSignRegex)
                const boughtPastMonth = plusSignRegex.test(plusSignText) ? plusSignText[0] : "N/A"

                if (productName) {
                    return {
                        productName,
                        sponsored,
                        badge,
                        price,
                        basePrice,
                        rating,
                        ratingNumber,
                        boughtPastMonth
                    }
                } else {
                    return null
                }
            }).filter(card => card != null)
            return cardInfo
        })
        cardData.push(...pageCardData)

        if (scrapePage == null || currentPage < scrapeToPage) {
            const nextPageButton = await page.$('.s-pagination-next')
            if (nextPageButton) {
                const isDisabled = await page.evaluate(btn => btn.hasAttribute('aria-disabled'), nextPageButton)
                if (!isDisabled) {
                    const nextPageUrl = encodeURI(await page.evaluate((nextBtn => nextBtn.href, nextPageButton)))
                    await scrapePage(nextPageUrl, currentPage, scrapeToPage
                    )
                } else {
                    console.log("All available page scraped:", currentPage)
                }

            } else if (!scrapeToPage || currentPage
                < scrapeToPage) {
                console.log("All available page scrapped", currentPage)

            }
        }
    }
    await scrapePage(url, 1, scrapeToPage)

    console.log("Scraping finished.")

    const outputFileName = "scrapedData,json";
    fs.writeFileSync(outputFileName, JSON.stringify(cardData, null, 2), "utf8");
    console.log(`Data saved to ${outputFileName}`)
    await browser.close();
})();