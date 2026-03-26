"use strict";

var obsidian = require("obsidian");

class ModuleNavigatorPlugin extends obsidian.Plugin {
	async onload() {
		this.addCommand({
			id: "navigate-next-in-module",
			name: "Navigate to next file in module",
			hotkeys: [{ modifiers: ["Alt"], key: "PageDown" }],
			callback: () => this.navigateModule(1),
		});

		this.addCommand({
			id: "navigate-prev-in-module",
			name: "Navigate to previous file in module",
			hotkeys: [{ modifiers: ["Alt"], key: "PageUp" }],
			callback: () => this.navigateModule(-1),
		});
	}

	findModuleRoot(file) {
		let folder = file.parent;
		if (!folder) return null;

		let best = null;
		let current = file.parent;
		while (current && current.parent) {
			if (/^\d+\./.test(current.name)) {
				best = current;
			}
			current = current.parent;
		}
		return best;
	}

	collectFiles(folder) {
		const files = [];
		for (const child of folder.children) {
			if (child instanceof obsidian.TFile && child.extension === "md") {
				files.push(child);
			} else if (child instanceof obsidian.TFolder) {
				files.push(...this.collectFiles(child));
			}
		}
		return files;
	}

	naturalSort(a, b) {
		const aParts = a.path.split(/[\\/]/);
		const bParts = b.path.split(/[\\/]/);
		const len = Math.max(aParts.length, bParts.length);

		for (let i = 0; i < len; i++) {
			const aPart = aParts[i] || "";
			const bPart = bParts[i] || "";

			const aMatch = aPart.match(/^(\d+(?:\.\d+)*)/);
			const bMatch = bPart.match(/^(\d+(?:\.\d+)*)/);

			if (aMatch && bMatch) {
				const aNums = aMatch[1].split(".").map(Number);
				const bNums = bMatch[1].split(".").map(Number);
				const numLen = Math.max(aNums.length, bNums.length);

				for (let j = 0; j < numLen; j++) {
					const aNum = aNums[j] !== undefined ? aNums[j] : -1;
					const bNum = bNums[j] !== undefined ? bNums[j] : -1;
					if (aNum !== bNum) return aNum - bNum;
				}

				const aRest = aPart.slice(aMatch[0].length);
				const bRest = bPart.slice(bMatch[0].length);
				if (aRest !== bRest) return aRest.localeCompare(bRest);
			} else {
				const cmp = aPart.localeCompare(bPart);
				if (cmp !== 0) return cmp;
			}
		}
		return 0;
	}

	navigateModule(direction) {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new obsidian.Notice("No active file", 1500);
			return;
		}

		const moduleRoot = this.findModuleRoot(activeFile);
		if (!moduleRoot) {
			new obsidian.Notice("Could not find module root", 1500);
			return;
		}

		const allFiles = this.collectFiles(moduleRoot).sort((a, b) => this.naturalSort(a, b));

		if (allFiles.length <= 1) {
			new obsidian.Notice("No other files in module", 1500);
			return;
		}

		const currentIndex = allFiles.findIndex((f) => f.path === activeFile.path);
		if (currentIndex === -1) return;

		const targetIndex = (currentIndex + direction + allFiles.length) % allFiles.length;
		const targetFile = allFiles[targetIndex];

		this.app.workspace.getLeaf(false).openFile(targetFile);
		new obsidian.Notice(
			targetFile.basename + "  (" + (targetIndex + 1) + "/" + allFiles.length + ")",
			2000
		);
	}
}

module.exports = ModuleNavigatorPlugin;
