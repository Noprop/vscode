/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri, WorkspaceFolder, TextEditor } from 'vscode';
import * as fs from 'fs';

export interface GitUriParams {
	path: string;
	ref: string;
	submoduleOf?: string;
}

export function isGitUri(uri: Uri): boolean {
	return /^git$/.test(uri.scheme);
}

export function fromGitUri(uri: Uri): GitUriParams {
	return JSON.parse(uri.query);
}

export interface GitUriOptions {
	replaceFileExtension?: boolean;
	submoduleOf?: string;
}

// As a mitigation for extensions like ESLint showing warnings and errors
// for git URIs, let's change the file extension of these uris to .git,
// when `replaceFileExtension` is true.
export function toGitUri(uri: Uri, ref: string, options: GitUriOptions = {}): Uri {
	const params: GitUriParams = {
		path: uri.fsPath,
		ref
	};

	if (options.submoduleOf) {
		params.submoduleOf = options.submoduleOf;
	}

	let path = uri.path;

	if (options.replaceFileExtension) {
		path = `${path}.git`;
	} else if (options.submoduleOf) {
		path = `${path}.diff`;
	}

	return uri.with({
		scheme: 'git',
		path,
		query: JSON.stringify(params)
	});
}

/**
 * Assuming `uri` is being merged it creates uris for `base`, `ours`, and `theirs`
 */
export function toMergeUris(uri: Uri): { base: Uri; ours: Uri; theirs: Uri } {
	return {
		base: toGitUri(uri, ':1'),
		ours: toGitUri(uri, ':2'),
		theirs: toGitUri(uri, ':3'),
	};
}


export function fromGitUriAndResolve(uri: Uri): GitUriParams {
	const parsedQuery = JSON.parse(uri.query);
	try {
		return {
			...parsedQuery,
			path: fs.realpathSync(parsedQuery.path)
		};
	} catch (e) {
		return parsedQuery;
	}
}

export function resolvePath(path: string): string {
	try {
		return fs.realpathSync(path);
	} catch (e) {
		// unable to resolve
		return path;
	}
}

export function resolveUri(uri: Uri): Uri {
	return uri.with({
		...uri,
		path: resolvePath(uri.path)
	});
}

export function resolveUriWithGitScheme(uri: Uri): Uri {
	try {
		// keep trailing .git if found
		const endsInGit = /.git$/.test(uri.path);
		const oldPathResolved = resolvePath(endsInGit ? uri.path.replace(/.git$/, '') : uri.path);
		const newUriObj = {
			...uri,
			path: endsInGit ? oldPathResolved + '.git' : oldPathResolved,
		};
		if (uri.query) {
			newUriObj.query = JSON.stringify(fromGitUriAndResolve(uri));
		}
		return uri.with(newUriObj);
	} catch (e) {
		// unable to resovle
		return uri;
	}
}

export function resolveWorkspaceFolders(workspaceFolders: readonly WorkspaceFolder[] | undefined): WorkspaceFolder[] {
	const newFolders: WorkspaceFolder[] = [];
	if (!workspaceFolders) {
		return [];
	}
	workspaceFolders.forEach(folder => {
		newFolders.push({
			...folder,
			uri: folder.uri.with({
				...folder.uri,
				path: resolvePath(folder.uri.path)
			})
		});
	});
	return newFolders;
}

export function resolveWindowVisibleTextEditors(editors: readonly TextEditor[]): TextEditor[] {
	const newEditors: TextEditor[] = [];
	editors.forEach(editor => {
		newEditors.push({
			...editor,
			document: {
				...editor.document,
				uri: resolveUri(editor.document.uri)
			}
		});
	});
	return newEditors;
}
