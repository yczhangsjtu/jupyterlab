// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { test } from '@jupyterlab/galata';
import { expect } from '@playwright/test';
import * as path from 'path';

const fileName = 'search.ipynb';

function getSelectionRange(textarea: HTMLTextAreaElement) {
  return {
    start: textarea.selectionStart,
    end: textarea.selectionEnd
  };
}

test.describe('Notebook Search', () => {
  test.beforeEach(async ({ page, tmpPath }) => {
    await page.contents.uploadFile(
      path.resolve(__dirname, `./notebooks/${fileName}`),
      `${tmpPath}/${fileName}`
    );

    await page.notebook.openByPath(`${tmpPath}/${fileName}`);
    await page.notebook.activate(fileName);
  });

  test.afterEach(async ({ page, tmpPath }) => {
    await page.contents.deleteDirectory(tmpPath);
  });

  test('Search', async ({ page }) => {
    // Open search box
    await page.keyboard.press('Control+f');

    await page.fill('[placeholder="Find"]', 'with');

    await page.waitForSelector('text=1/21');

    const nbPanel = await page.notebook.getNotebookInPanel();

    expect(await nbPanel.screenshot()).toMatchSnapshot('search.png');
  });

  test('Typing in search box', async ({ page }) => {
    // Check against React being too eager with controling state of input box
    await page.keyboard.press('Control+f');

    await page.fill('[placeholder="Find"]', '14');
    await page.press('[placeholder="Find"]', 'ArrowLeft');
    await page.type('[placeholder="Find"]', '2');
    await page.type('[placeholder="Find"]', '3');

    await expect(page.locator('[placeholder="Find"]')).toHaveValue('1234');
  });

  test('RegExp parsing failure', async ({ page }) => {
    await page.keyboard.press('Control+f');

    await page.fill('[placeholder="Find"]', 'test\\');

    await page.click('button[title="Use Regular Expression"]');

    await expect(page.locator('.jp-DocumentSearch-regex-error')).toBeVisible();

    const overlay = page.locator('.jp-DocumentSearch-overlay');

    expect(await overlay.screenshot()).toMatchSnapshot(
      'regexp-parsing-failure.png'
    );
  });

  test('Multi-line search', async ({ page }) => {
    await page.keyboard.press('Control+f');

    await page.fill(
      '[placeholder="Find"]',
      'one notebook withr\n\n\nThis is a multi'
    );

    await page.waitForSelector('text=1/1');

    // Show replace buttons to check for visual regressions
    await page.click('button[title="Toggle Replace"]');
    await page.fill('[placeholder="Replace"]', 'line1\nline2');

    const overlay = page.locator('.jp-DocumentSearch-overlay');
    expect(await overlay.screenshot()).toMatchSnapshot('multi-line-search.png');
  });

  test('Populate search box with selected text', async ({ page }) => {
    // Enter first cell
    await page.notebook.enterCellEditingMode(0);

    // Go to first line
    await page.keyboard.press('PageUp');
    // Select first line
    await page.keyboard.press('Shift+End');
    // Open search box
    await page.keyboard.press('Control+f');

    // Expect it to be populated with the first line
    const inputWithFirstLine = page.locator(
      '[placeholder="Find"] >> text="Test with one notebook withr"'
    );
    await expect(inputWithFirstLine).toBeVisible();
    await expect(inputWithFirstLine).toBeFocused();
    // Expect the newly set text to be selected
    expect(await inputWithFirstLine.evaluate(getSelectionRange)).toStrictEqual({
      start: 0,
      end: 28
    });

    // Expect the first match to be highlighted
    await page.waitForSelector('text=1/2');

    // Enter first cell again
    await page.notebook.enterCellEditingMode(0);
    // Go to last line
    await page.keyboard.press('PageDown');
    // Select last line
    await page.keyboard.press('Shift+Home');
    // Update search box
    await page.keyboard.press('Control+f');

    // Expect it to be populated with the last line
    const inputWithLastLine = page.locator(
      '[placeholder="Find"] >> text="This is a multi line with hits with"'
    );
    await expect(inputWithLastLine).toBeVisible();
    await expect(inputWithLastLine).toBeFocused();
    // Expect the newly set text to be selected
    expect(await inputWithLastLine.evaluate(getSelectionRange)).toStrictEqual({
      start: 0,
      end: 35
    });

    await expect(page.locator('.jp-DocumentSearch-overlay')).toBeVisible();
  });

  test('Restore previous search query if there is no selection', async ({
    page
  }) => {
    const inputWithTestLocator = page.locator(
      '[placeholder="Find"] >> text="test"'
    );
    const overlayLocator = page.locator('.jp-DocumentSearch-overlay');

    // Search for "test"
    await page.keyboard.press('Control+f');
    await page.fill('[placeholder="Find"]', 'test');
    await page.waitForSelector('text=1/2');

    // Close search box
    await page.keyboard.press('Escape');
    await expect(overlayLocator).toBeHidden();

    // Open search box again
    await page.keyboard.press('Control+f');
    await expect(overlayLocator).toBeVisible();
    // Expect the text to be set in the input field
    await expect(inputWithTestLocator).toBeVisible();
    // Expect the search to be active again
    await page.waitForSelector('text=1/2');
  });

  test('Close with Escape', async ({ page }) => {
    // Open search box
    await page.keyboard.press('Control+f');
    await expect(page.locator('.jp-DocumentSearch-overlay')).toBeVisible();

    // Close search box
    await page.keyboard.press('Escape');
    await expect(page.locator('.jp-DocumentSearch-overlay')).toBeHidden();
  });

  test('Close with Escape from Notebook', async ({ page }) => {
    // Open search box
    await page.keyboard.press('Control+f');
    await expect(page.locator('.jp-DocumentSearch-overlay')).toBeVisible();

    // Enter first cell
    await page.notebook.enterCellEditingMode(0);

    // First escape should NOT close the search box (but leave the editing mode)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    expect(await page.notebook.isCellInEditingMode(0)).toBeFalsy();
    expect(await page.isVisible('.jp-DocumentSearch-overlay')).toBeTruthy();

    // Second escape should close the search box (even if it is not focused)
    await page.keyboard.press('Escape');
    await expect(page.locator('.jp-DocumentSearch-overlay')).toBeHidden();
  });

  test('Search within outputs', async ({ page }) => {
    // Open search box
    await page.keyboard.press('Control+f');

    await page.fill('[placeholder="Find"]', 'with');

    await page.click('button[title="Show Search Filters"]');

    await page.click('text=Search Cell Outputs');

    await page.waitForSelector('text=1/29');

    const cell = await page.notebook.getCell(5);
    await cell.scrollIntoViewIfNeeded();

    const nbPanel = await page.notebook.getNotebookInPanel();

    expect(await nbPanel.screenshot()).toMatchSnapshot(
      'search-within-outputs.png'
    );
  });

  test('Search in a single selected cell', async ({ page }) => {
    // Open search box
    await page.keyboard.press('Control+f');

    await page.fill('[placeholder="Find"]', 'with');

    await page.click('button[title="Show Search Filters"]');

    await page.click('text=Search in 1 Selected Cell');

    await page.waitForSelector('text=1/4');

    const nbPanel = await page.notebook.getNotebookInPanel();
    expect(await nbPanel.screenshot()).toMatchSnapshot(
      'search-in-selected-cells.png'
    );
  });

  test('Search in multiple selected cells', async ({ page }) => {
    await page.keyboard.press('Control+f');
    await page.fill('[placeholder="Find"]', 'with');
    await page.click('button[title="Show Search Filters"]');
    await page.click('text=Search in 1 Selected Cell');

    // Bring focus to first cell without switching away from command mode
    let cell = await page.notebook.getCell(0);
    await (await cell.$('.jp-InputPrompt')).click();

    // Select two cells below
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Shift+ArrowDown');

    // Expect the filter text to be updated
    await page.waitForSelector('text=Search in 3 Selected Cells');

    // Reset selection, switch to third cell, preserving command mode
    cell = await page.notebook.getCell(2);
    await (await cell.$('.jp-InputPrompt')).click();

    await page.waitForSelector('text=Search in 1 Selected Cell');

    // Select cell above
    await page.keyboard.press('Shift+ArrowUp');

    // Expect updated text
    await page.waitForSelector('text=Search in 2 Selected Cells');

    // Expect 15 matches; this is 6/15, not 1/15 because current match is set
    // in second cell and when selection is extended, it does not move; keeping
    // the current match when extending the selection is desired as user may use
    // it as a reference, especially when it was set as closest to the cursor.
    await page.waitForSelector('text=6/15');

    const nbPanel = await page.notebook.getNotebookInPanel();
    expect(await nbPanel.screenshot()).toMatchSnapshot(
      'search-in-two-selected-cells.png'
    );
  });

  test('Search in multiple selected cells from edit mode', async ({ page }) => {
    // This is testing focus handling when extending the selection after
    // switching focus away from cell editor, which needs to protect against
    // race conditions and CodeMirror6 focus issues when highlights get added.
    await page.keyboard.press('Control+f');
    await page.fill('[placeholder="Find"]', 'with');
    await page.click('button[title="Show Search Filters"]');
    await page.click('text=Search in 1 Selected Cell');
    await page.waitForSelector('text=1/4');

    // Bring focus to first cell without switching to edit mode
    let cell = await page.notebook.getCell(0);
    await (await cell.$('.jp-Editor')).click();

    // Switch back to command mode
    await page.keyboard.press('Escape');

    // Select two cells below
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Shift+ArrowDown');

    // Expect the filter text to be updated
    await page.waitForSelector('text=Search in 3 Selected Cells');

    // Expect 19 matches
    await page.waitForSelector('text=1/19');
  });

  test('Search in selected text', async ({ page }) => {
    await page.keyboard.press('Control+f');

    await page.fill('[placeholder="Find"]', 'text/');
    await page.waitForSelector('text=1/3');

    // Activate third cell
    const cell = await page.notebook.getCell(2);
    const editor = await cell.$('.jp-Editor');
    await editor.click();

    // Select 7 lines
    await page.keyboard.press('Control+Home');
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+ArrowDown');
    }

    // Switch to selection search mode
    await page.click('button[title="Show Search Filters"]');
    await page.click('text=Search in 7 Selected Lines');

    await page.waitForSelector('text=1/2');

    const nbPanel = await page.notebook.getNotebookInPanel();

    expect(await nbPanel.screenshot()).toMatchSnapshot(
      'search-in-selected-text.png'
    );
  });

  test('Highlights are visible when text is selected', async ({ page }) => {
    await page.keyboard.press('Control+f');
    await page.fill('[placeholder="Find"]', 'with');
    await page.waitForSelector('text=1/21');

    const cell = await page.notebook.getCell(0);
    const editor = await cell.$('.jp-Editor');
    await editor.click();

    // Select text (to see if the highlights will still be visible)
    await page.keyboard.press('Control+A');

    expect(await (await cell.$('.jp-Editor')).screenshot()).toMatchSnapshot(
      'highlight-visible-under-selection.png'
    );
  });

  test('Highlight next hit same editor', async ({ page }) => {
    // Open search box
    await page.keyboard.press('Control+f');

    await page.fill('[placeholder="Find"]', 'with');

    await page.waitForSelector('text=1/21');

    // Click next button
    await page.click('button[title="Next Match"]');

    const cell = await page.notebook.getCell(0);

    expect(await (await cell.$('.jp-Editor')).screenshot()).toMatchSnapshot(
      'highlight-next-in-editor.png'
    );
  });

  test('Highlight next hit in the next cell', async ({ page }) => {
    // Open search box
    await page.keyboard.press('Control+f');

    await page.fill('[placeholder="Find"]', 'with');

    await page.waitForSelector('text=1/21');

    // Click next button
    await page.click('button[title="Next Match"]', {
      clickCount: 4
    });

    const cell = await page.notebook.getCell(1);

    expect(await cell.screenshot()).toMatchSnapshot('highlight-next-cell.png');
  });

  test('Highlight previous hit', async ({ page }) => {
    // Open search box
    await page.keyboard.press('Control+f');

    await page.fill('[placeholder="Find"]', 'with');

    await page.waitForSelector('text=1/21');

    // Click previous button
    await page.click('button[title="Previous Match"]');
    // Should cycle back
    await page.waitForSelector('text=21/21');

    // Click previous button twice
    await page.click('button[title="Previous Match"]');
    await page.click('button[title="Previous Match"]');
    // Should move up by two
    await page.waitForSelector('text=19/21');

    const hit = await page.notebook.getCell(2);
    expect(await hit.screenshot()).toMatchSnapshot(
      'highlight-previous-element.png'
    );
  });

  test('Search from cursor', async ({ page }) => {
    const cell = await page.notebook.getCell(5);
    await cell.click();
    await page.keyboard.press('Escape');
    await cell.scrollIntoViewIfNeeded();

    // Open search box
    await page.keyboard.press('Control+f');
    await page.fill('[placeholder="Find"]', 'with');
    await page.waitForSelector('text=20/21');

    // Click previous button
    await page.click('button[title="Previous Match"]');
    await page.waitForSelector('text=19/21');
  });

  test('Highlight on markdown rendered state change', async ({ page }) => {
    // Open search box
    await page.keyboard.press('Control+f');

    await page.fill('[placeholder="Find"]', 'with');

    await page.waitForSelector('text=1/21');

    // Click next button
    await page.click('button[title="Next Match"]', {
      clickCount: 4
    });

    const cell = await page.notebook.getCell(1);

    await cell.dblclick();

    expect(await (await cell.$('.jp-Editor')).screenshot()).toMatchSnapshot(
      'highlight-markdown-switch-state.png'
    );
  });

  test('Search on typing', async ({ page }) => {
    // Open search box
    await page.keyboard.press('Control+f');

    await page.fill('[placeholder="Find"]', 'with');

    await page.notebook.setCell(5, 'code', 'with');

    const cell = await page.notebook.getCell(5);
    expect(await cell.screenshot()).toMatchSnapshot('search-typing.png');
  });

  test('Search new outputs', async ({ page }) => {
    // Open search box
    await page.keyboard.press('Control+f');

    await page.fill('[placeholder="Find"]', 'with');

    await page.click('button[title="Show Search Filters"]');

    await page.click('text=Search Cell Outputs');

    await page.waitForSelector('text=1/29');

    const cell = await page.notebook.getCell(5);

    await cell.click();

    await page.notebook.runCell(5);
    expect(await cell.screenshot()).toMatchSnapshot('search-new-outputs.png');
  });

  test('Search on new cell', async ({ page }) => {
    // Open search box
    await page.keyboard.press('Control+f');

    await page.fill('[placeholder="Find"]', 'with');

    await page.waitForSelector('text=1/21');

    const cell = await page.notebook.getCell(5);
    await cell.click();
    await page.notebook.clickToolbarItem('insert');
    await page.notebook.setCell(6, 'code', 'with');

    const nbPanel = await page.notebook.getNotebookInPanel();

    expect(await nbPanel.screenshot()).toMatchSnapshot(
      'search-on-new-cell.png'
    );
  });

  test('Search on deleted cell', async ({ page }) => {
    // Open search box
    await page.keyboard.press('Control+f');

    await page.fill('[placeholder="Find"]', 'with');

    await page.waitForSelector('text=1/21');

    const cell = await page.notebook.getCell(5);
    await cell.click();
    await page.keyboard.press('Escape');
    await cell.scrollIntoViewIfNeeded();

    await page.keyboard.press('d');
    await page.keyboard.press('d');

    await page.waitForSelector('text=1/19');

    const nbPanel = await page.notebook.getNotebookInPanel();

    expect(await nbPanel.screenshot()).toMatchSnapshot(
      'search-on-deleted-cell.png'
    );
  });
});
