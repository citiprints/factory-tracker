"use client";
import React, { useEffect, useState } from "react";

type FileInfo = {
	key: string;
	size: number;
	lastModified: Date;
	url: string;
	contentType: string;
};

export default function FilesPage() {
	const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
	const [files, setFiles] = useState<FileInfo[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [deletingKey, setDeletingKey] = useState<string | null>(null);
	const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
	const [bulkDeleting, setBulkDeleting] = useState(false);

	// Check authentication
	useEffect(() => {
		const checkAuth = async () => {
			try {
				const res = await fetch("/api/auth/me");
				if (res.ok) {
					const userData = await res.json();
					setCurrentUser(userData);
				} else {
					// Redirect to homepage if not authenticated
					window.location.href = "/";
					return;
				}
			} catch (error) {
				console.error('Auth check error:', error);
				window.location.href = "/";
				return;
			}
		};

		checkAuth();
	}, []);

	useEffect(() => {
		loadFiles();
	}, []);

	async function loadFiles() {
		setLoading(true);
		try {
			const res = await fetch("/api/files");
			if (res.ok) {
				const data = await res.json();
				setFiles(data.files || []);
			} else {
				setError("Failed to load files");
			}
		} catch (error) {
			setError("Failed to load files");
		} finally {
			setLoading(false);
		}
	}

	async function deleteFile(key: string) {
		if (!confirm("Are you sure you want to delete this file?")) return;
		
		setDeletingKey(key);
		try {
			const res = await fetch(`/api/files/${encodeURIComponent(key)}`, {
				method: "DELETE"
			});
			
			if (res.ok) {
				setFiles(prev => prev.filter(f => f.key !== key));
				setSelectedFiles(prev => {
					const newSet = new Set(prev);
					newSet.delete(key);
					return newSet;
				});
			} else {
				const errorData = await res.json();
				alert(errorData.error || "Failed to delete file");
			}
		} catch (error) {
			alert("Failed to delete file");
		} finally {
			setDeletingKey(null);
		}
	}

	async function bulkDeleteFiles() {
		if (selectedFiles.size === 0) return;
		
		const confirmMessage = `Are you sure you want to delete ${selectedFiles.size} file${selectedFiles.size > 1 ? 's' : ''}?`;
		if (!confirm(confirmMessage)) return;
		
		setBulkDeleting(true);
		try {
			const deletePromises = Array.from(selectedFiles).map(async (key) => {
				try {
					const res = await fetch(`/api/files/${encodeURIComponent(key)}`, {
						method: "DELETE"
					});
					return res.ok ? key : null;
				} catch (error) {
					console.error(`Failed to delete file ${key}:`, error);
					return null;
				}
			});

			const deletedKeys = (await Promise.all(deletePromises)).filter(key => key !== null);
			
			if (deletedKeys.length > 0) {
				setFiles(prev => prev.filter(f => !deletedKeys.includes(f.key)));
				setSelectedFiles(new Set());
				alert(`Successfully deleted ${deletedKeys.length} file${deletedKeys.length > 1 ? 's' : ''}`);
			}
		} catch (error) {
			alert("Failed to delete some files");
		} finally {
			setBulkDeleting(false);
		}
	}

	function toggleFileSelection(key: string) {
		setSelectedFiles(prev => {
			const newSet = new Set(prev);
			if (newSet.has(key)) {
				newSet.delete(key);
			} else {
				newSet.add(key);
			}
			return newSet;
		});
	}

	function toggleAllFiles() {
		if (selectedFiles.size === files.length) {
			setSelectedFiles(new Set());
		} else {
			setSelectedFiles(new Set(files.map(f => f.key)));
		}
	}

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleString();
	}

	if (loading) {
		return (
			<div className="container mx-auto px-4 py-8">
				<h1 className="text-2xl font-bold mb-6">File Uploads</h1>
				<div className="space-y-4">
					{Array.from({ length: 5 }).map((_, i) => (
						<div key={i} className="animate-pulse">
							<div className="bg-gray-200 h-16 rounded"></div>
						</div>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex justify-between items-center mb-6">
				<h1 className="text-2xl font-bold">File Uploads</h1>
				<div className="flex gap-2">
					{selectedFiles.size > 0 && (
						<button
							onClick={bulkDeleteFiles}
							disabled={bulkDeleting}
							className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
						>
							{bulkDeleting ? "Deleting..." : `Delete ${selectedFiles.size} File${selectedFiles.size > 1 ? 's' : ''}`}
						</button>
					)}
					<button
						onClick={loadFiles}
						className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
					>
						Refresh
					</button>
				</div>
			</div>

			{error && (
				<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
					{error}
				</div>
			)}

			{files.length === 0 ? (
				<div className="text-center py-8 text-gray-500">
					No files uploaded yet.
				</div>
			) : (
				<div className="bg-white rounded-lg shadow overflow-hidden">
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-gray-200">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-6 py-3 text-left">
										<input
											type="checkbox"
											checked={selectedFiles.size === files.length && files.length > 0}
											onChange={toggleAllFiles}
											className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
										/>
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										File Name
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Size
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Uploaded
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Actions
									</th>
								</tr>
							</thead>
							<tbody className="bg-white divide-y divide-gray-200">
								{files.map((file) => (
									<tr key={file.key} className="hover:bg-gray-50">
										<td className="px-6 py-4 whitespace-nowrap">
											<input
												type="checkbox"
												checked={selectedFiles.has(file.key)}
												onChange={() => toggleFileSelection(file.key)}
												className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
											/>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="flex items-center">
												<div className="text-sm font-medium text-gray-900">
													{file.key.split('/').pop() || file.key}
												</div>
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{formatFileSize(file.size)}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{formatDate(file.lastModified)}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
											<div className="flex space-x-2">
												<a
													href={file.url}
													target="_blank"
													rel="noopener noreferrer"
													className="text-blue-600 hover:text-blue-900"
												>
													View
												</a>
												<button
													onClick={() => deleteFile(file.key)}
													disabled={deletingKey === file.key}
													className="text-red-600 hover:text-red-900 disabled:opacity-50"
												>
													{deletingKey === file.key ? "Deleting..." : "Delete"}
												</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			<div className="mt-4 text-sm text-gray-500">
				{selectedFiles.size > 0 && (
					<span className="mr-4">
						{selectedFiles.size} of {files.length} files selected
					</span>
				)}
				Total files: {files.length} | Total size: {formatFileSize(files.reduce((sum, file) => sum + file.size, 0))}
			</div>
		</div>
	);
}
