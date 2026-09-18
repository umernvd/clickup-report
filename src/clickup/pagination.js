import { sleep } from "../utils/sleep.js";

export async function fetchAllPages(requestFn) {
  let page = 0;
  let allItems = [];

  while (true) {
    const items = await requestFn(page);

    allItems.push(...items);

    if (items.length < 100) {
      break;
    }

    page += 1;
    await sleep(250);
  }

  console.log(`Fetched ${allItems.length} items`);
  return allItems;
}
