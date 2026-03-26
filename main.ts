import { Plugin, Notice, TFile, TFolder } from "obsidian";

export default class ModuleNavigatorPlugin extends Plugin {
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

	// Walk up from the active file to find the module root folder
	// Module root = the numbered folder like "7. openITCOCKPIT XSS and OS Command..."
	// that sits directly under the course folder (e.g. OSWE/)
	findModuleRoot(file: TFile): TFolder | null {
		let folder = file.parent;
		if (!folder) return null;

		// Keep going up while the parent still looks like a nested section
		// Stop when the parent is the course-level folder (OSWE, etc.)
		// Heuristic: module root's name starts with a single digit + "."
		// e.g. "7. openITCOCKPIT..." but NOT "7.3.1. Building..."
		let candidate = folder;
		while (folder) {
			candidate = folder;
			folder = folder.parent;
			if (!folder || !folder.parent) {
				// candidate's parent is vault root — candidate is course level, too high
				// go back one level
				break;
			}
		}

		// If we went too far up, try a smarter approach:
		// Find the highest ancestor whose name starts with "N. " (single number dot)
		let best: TFolder | null = null;
		let current = file.parent;
		while (current && current.parent) {
			if (/^\d+\./.test(current.name)) {
				best = current;
			}
			current = current.parent;
		}

		return best;
	}

	// Recursively collect all .md files from a folder
	collectFiles(folder: TFolder): TFile[] {
		const files: TFile[] = [];
		for (const child of folder.children) {
			if (child instanceof TFile && child.extension === "md") {
				files.push(child);
			} else if (child instanceof TFolder) {
				files.push(...this.collectFiles(child));
			}
		}
		return files;
	}

	// Natural sort: "7.1." comes before "7.2.", "7.3.1." before "7.3.2.", etc.
	naturalSort(a: TFile, b: TFile): number {
		const aParts = a.path.split(/[\\/]/);
		const bParts = b.path.split(/[\\/]/);
		const len = Math.max(aParts.length, bParts.length);

		for (let i = 0; i < len; i++) {
			const aPart = aParts[i] || "";
			const bPart = bParts[i] || "";

			// Extract leading numbers for numeric comparison
			const aMatch = aPart.match(/^(\d+(?:\.\d+)*)/);
			const bMatch = bPart.match(/^(\d+(?:\.\d+)*)/);

			if (aMatch && bMatch) {
				const aNums = aMatch[1].split(".").map(Number);
				const bNums = bMatch[1].split(".").map(Number);
				const numLen = Math.max(aNums.length, bNums.length);

				for (let j = 0; j < numLen; j++) {
					const aNum = aNums[j] ?? -1;
					const bNum = bNums[j] ?? -1;
					if (aNum !== bNum) return aNum - bNum;
				}

				// Numbers are equal, compare the rest of the string
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

	navigateModule(direction: 1 | -1) {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active file", 1500);
			return;
		}

		const moduleRoot = this.findModuleRoot(activeFile);
		if (!moduleRoot) {
			new Notice("Could not find module root", 1500);
			return;
		}

		const allFiles = this.collectFiles(moduleRoot).sort((a, b) => this.naturalSort(a, b));

		if (allFiles.length <= 1) {
			new Notice("No other files in module", 1500);
			return;
		}

		const currentIndex = allFiles.findIndex((f) => f.path === activeFile.path);
		if (currentIndex === -1) return;

		const targetIndex = (currentIndex + direction + allFiles.length) % allFiles.length;
		const targetFile = allFiles[targetIndex];

		this.app.workspace.getLeaf(false).openFile(targetFile);
		new Notice(`${targetFile.basename}  (${targetIndex + 1}/${allFiles.length})`, 2000);
	}
}
