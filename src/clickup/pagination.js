import { sleep } from '../utils/sleep.js';

export async function fetchAllPages(requestFn) {
  let page = 0;
  let allItems = [];

  while (true) {
    const items = await requestFn(page);
    console.log(`Fetching page ${page}... (${items.length} items returned)`);

    allItems = allItems.concat(items);

    if (items.length < 100) {
      break;
    }

    page += 1;
    await sleep(250);
  }

  console.log(`Pagination complete. Total items fetched: ${allItems.length}`);
  return allItems;
}
