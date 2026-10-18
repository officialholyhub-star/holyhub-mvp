import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypescript } from './helpers/load-typescript.mjs';
const { PRODUCT_CATEGORIES, isProductCategory, isAllowedProductCategory, marketplaceCategoryValues, productCategoryLabel } = loadTypescript('lib/product-categories.ts');
const { CSV_COLUMNS, validateProductCsv } = loadTypescript('lib/product-csv.ts');
test('creation and CSV use the exact seven categories', () => {
 assert.deepEqual(Array.from(PRODUCT_CATEGORIES), ['Apparel','Bookmarks','Gifts','Books','Jewellery','Home & Living','Arts']);
 for (const category of PRODUCT_CATEGORIES) {
  assert.equal(isProductCategory(category), true);
  const data = {'Product name':'Product',Description:'Description',Price:'10','Stock quantity':'1',Category:category};
  if (category === 'Apparel') for (const size of ['XS','S','M','L','XL','XXL']) data[`${size} Stock`] = '1';
  const row = CSV_COLUMNS.map(column=>data[column] ?? '').join(',');
  assert.equal(validateProductCsv(`${CSV_COLUMNS.join(',')}\n${row}`)[0].product?.category_type,category);
 }
 for (const category of ['Art','clothes','coat','marketing','arts','']) assert.equal(isProductCategory(category),false);
});
test('only the unchanged saved legacy category is allowed on edit', () => {
 assert.equal(isAllowedProductCategory('clothes','clothes'),true);
 assert.equal(isAllowedProductCategory('marketing','clothes'),false);
 assert.equal(isAllowedProductCategory('clothes'),false);
 assert.equal(isAllowedProductCategory('Arts','clothes'),true);
});
test('Art & Prints filtering includes existing Art products without rewriting their records', () => {
 assert.deepEqual(Array.from(marketplaceCategoryValues('Art & Prints')),['Arts','Art']);
 assert.equal(productCategoryLabel('Art'),'Art & Prints');
 assert.equal(productCategoryLabel('marketing'),'marketing');
 assert.deepEqual(Array.from(marketplaceCategoryValues('Clothing & Accessories')),['Apparel']);
});
