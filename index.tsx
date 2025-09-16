import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';

const GITHUB_API_BASE = 'https://api.github.com/repos';
const IMAGES_PER_PAGE = 15;

// --- Utility Functions ---
const sanitizeFolderName = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9-]/g, '');
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
  });
};

// --- GitHub API Helper ---
const githubApi = {
  async request(path: string, token: string, options: RequestInit = {}) {
    const response = await fetch(`${GITHUB_API_BASE}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`GitHub API Error: ${errorData.message}`);
    }
    if (response.status === 204 || response.headers.get('Content-Length') === '0') {
      return null;
    }
    return response.json();
  },
};

// --- React Components ---

const Notification = ({ message, type, onEnd }: { message: string | null; type: 'success' | 'error'; onEnd: () => void }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (message) {
            setVisible(true);
            const timer = setTimeout(() => {
                setVisible(false);
                setTimeout(onEnd, 300);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [message, onEnd]);

    return (
        <div className={`notification ${type} ${visible ? 'show' : ''}`}>
            {message}
        </div>
    );
};

const GitHubConfig = ({ onConfigSave, initialError }: { onConfigSave: (token: string, repo: string) => void; initialError: string | null; }) => {
    const [token, setToken] = useState('');
    const [repo, setRepo] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfigSave(token, repo);
    };

    return (
        <div className="config-container">
            <form onSubmit={handleSubmit} className="config-form">
                <h2>Cấu hình GitHub</h2>
                <p>Cần có Personal Access Token với quyền `repo`.</p>
                <input
                    type="password"
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    placeholder="GitHub Personal Access Token"
                    aria-label="GitHub Personal Access Token"
                    required
                />
                <input
                    type="text"
                    value={repo}
                    onChange={e => setRepo(e.target.value)}
                    placeholder="Repository (ví dụ: owner/repo)"
                    aria-label="Repository"
                    required
                />
                <button type="submit">Lưu và Kết nối</button>
                {initialError && <p className="error-message">{initialError}</p>}
            </form>
        </div>
    );
};

const Uploader = ({ activeFolder, onImageUpload }: { activeFolder: string; onImageUpload: (files: FileList) => void }) => {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(e.type === 'dragenter' || e.type === 'dragover');
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onImageUpload(e.dataTransfer.files);
        }
    };
    
    const handleClick = () => fileInputRef.current?.click();
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onImageUpload(e.target.files);
        }
    };

    return (
        <>
            <h3>Tải lên "{activeFolder}"</h3>
            <div
                className={`uploader-zone ${isDragging ? 'drag-over' : ''}`}
                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop} onClick={handleClick}
            >
                <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple accept="image/*" style={{display: 'none'}} />
                <p>Kéo và thả ảnh vào đây, hoặc nhấp để chọn tệp</p>
            </div>
        </>
    );
}

const App = () => {
    const [config, setConfig] = useState<{ token: string; repo: string } | null>(null);
    const [isConfigValid, setIsConfigValid] = useState(false);
    const [configError, setConfigError] = useState<string | null>(null);

    const [folders, setFolders] = useState<string[]>([]);
    const [images, setImages] = useState<any[]>([]);
    const [activeFolder, setActiveFolder] = useState<string | null>(null);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil(images.length / IMAGES_PER_PAGE);
    const paginatedImages = images.slice((currentPage - 1) * IMAGES_PER_PAGE, currentPage * IMAGES_PER_PAGE);

    const showNotification = (message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
    };

    const handleConfigSave = useCallback(async (token: string, repo: string) => {
        setIsLoading(true);
        setConfigError(null);
        try {
            await githubApi.request(`/${repo}`, token); // Test request
            localStorage.setItem('gh_token', token);
            localStorage.setItem('gh_repo', repo);
            setConfig({ token, repo });
            setIsConfigValid(true);
        } catch (error) {
            console.error(error);
            setConfigError("Không thể kết nối. Vui lòng kiểm tra lại Token và tên Repository.");
            setIsConfigValid(false);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const loadFolders = useCallback(async () => {
        if (!config) return;
        setIsLoading(true);
        try {
            const contents = await githubApi.request(`/${config.repo}/contents/`, config.token);
            const folderData = contents.filter((item: any) => item.type === 'dir').map((item: any) => item.name);
            setFolders(folderData);
            if (folderData.length > 0 && !activeFolder) {
                setActiveFolder(folderData[0]);
            }
        } catch (error) {
            showNotification(`Lỗi tải thư mục: ${(error as Error).message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [config, activeFolder]);
    
    useEffect(() => {
        const savedToken = localStorage.getItem('gh_token');
        const savedRepo = localStorage.getItem('gh_repo');
        if (savedToken && savedRepo) {
            handleConfigSave(savedToken, savedRepo);
        } else {
            setIsLoading(false);
        }
    }, [handleConfigSave]);

    useEffect(() => {
        if (isConfigValid) {
            loadFolders();
        }
    }, [isConfigValid, loadFolders]);

    const loadImagesForFolder = useCallback(async (folderName: string) => {
        if (!config) return;
        setIsLoading(true);
        setCurrentPage(1);
        try {
            const contents = await githubApi.request(`/${config.repo}/contents/${folderName}`, config.token);
            const imageData = contents.filter((item: any) => item.type === 'file' && /\.(jpg|jpeg|png|gif|webp)$/i.test(item.name));
            setImages(imageData);
        } catch (error) {
             setImages([]); // Folder might be empty
        } finally {
            setIsLoading(false);
        }
    }, [config]);

    useEffect(() => {
        if (activeFolder) {
            loadImagesForFolder(activeFolder);
        } else {
            setImages([]);
        }
    }, [activeFolder, loadImagesForFolder]);

    const handleAddFolder = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const input = form.elements.namedItem('folderName') as HTMLInputElement;
        const folderName = input.value.trim();
        if (!config || !folderName) return;

        const sanitized = sanitizeFolderName(folderName);
        if (folders.includes(sanitized)) {
            showNotification(`Thư mục "${sanitized}" đã tồn tại.`, 'error');
            return;
        }

        try {
            await githubApi.request(`/${config.repo}/contents/${sanitized}/.gitkeep`, config.token, {
                method: 'PUT',
                body: JSON.stringify({
                    message: `feat: Create folder '${sanitized}'`,
                    content: ''
                }),
            });
            showNotification(`Thư mục "${sanitized}" đã được tạo.`, 'success');
            setFolders([...folders, sanitized]);
            setActiveFolder(sanitized);
            input.value = '';
        } catch (error) {
            showNotification(`Không thể tạo thư mục: ${(error as Error).message}`, 'error');
        }
    };

    const handleImageUpload = async (files: FileList) => {
        if (!config || !activeFolder) return;
        
        setIsUploading(true);
        for (const file of Array.from(files)) {
            if (images.some(img => img.name === file.name)) {
                showNotification(`Lỗi: Ảnh "${file.name}" đã tồn tại trong thư mục này.`, 'error');
                continue;
            }
            try {
                const content = await fileToBase64(file);
                const path = `${activeFolder}/${file.name}`;
                const newFileData = await githubApi.request(`/${config.repo}/contents/${path}`, config.token, {
                    method: 'PUT',
                    body: JSON.stringify({
                        message: `feat: Add image ${file.name}`,
                        content,
                    }),
                });
                setImages(prev => [...prev, newFileData.content]);
                showNotification(`Đã tải lên: ${file.name}`, 'success');
            } catch (error) {
                showNotification(`Lỗi tải lên ${file.name}: ${(error as Error).message}`, 'error');
            }
        }
        setIsUploading(false);
    };

    const handleDeleteImage = async (image: any) => {
        if (!config || !window.confirm(`Bạn có chắc muốn xóa ảnh "${image.name}"?`)) return;

        try {
            await githubApi.request(`/${config.repo}/contents/${image.path}`, config.token, {
                method: 'DELETE',
                body: JSON.stringify({
                    message: `feat: Delete image ${image.name}`,
                    sha: image.sha,
                }),
            });
            setImages(prev => prev.filter(img => img.sha !== image.sha));
            showNotification(`Đã xóa: ${image.name}`, 'success');
        } catch (error) {
            showNotification(`Lỗi xóa ${image.name}: ${(error as Error).message}`, 'error');
        }
    };

    const handleCopyLink = (url: string) => {
        navigator.clipboard.writeText(url);
        showNotification('Đã sao chép liên kết!', 'success');
    };

    if (isLoading && !isConfigValid) {
        return <div className="loader" aria-label="Đang tải"></div>;
    }

    if (!isConfigValid) {
        return <GitHubConfig onConfigSave={handleConfigSave} initialError={configError} />;
    }

    return (
        <>
            <header><h1>GitHub Image Hoster</h1></header>
            <main className="app-container">
                <aside className="sidebar">
                    <h2>Thư mục</h2>
                    <ul className="folder-list">
                        {folders.map(folder => (
                            <li key={folder} className={`folder-item ${folder === activeFolder ? 'active' : ''}`} onClick={() => setActiveFolder(folder)}>
                                {folder}
                            </li>
                        ))}
                    </ul>
                    <form onSubmit={handleAddFolder} className="add-folder-form">
                        <input name="folderName" type="text" placeholder="Tên thư mục mới..." className="add-folder-input" aria-label="Tên thư mục mới" required />
                        <button type="submit" className="add-folder-button" aria-label="Thêm thư mục">+</button>
                    </form>
                </aside>
                <section className="main-content">
                    {activeFolder ? (
                        <>
                            <Uploader activeFolder={activeFolder} onImageUpload={handleImageUpload} />
                             {isUploading && <div className="loader" aria-label="Đang tải lên"></div>}
                            <div className="gallery-container">
                                {paginatedImages.map(image => (
                                    <div key={image.sha} className="gallery-item" onClick={() => handleCopyLink(image.download_url)}>
                                        <button className="delete-button" aria-label="Xóa ảnh" onClick={(e) => { e.stopPropagation(); handleDeleteImage(image); }}>🗑️</button>
                                        <img src={image.download_url} alt={image.name} className="gallery-image" />
                                        <div className="image-info">
                                            <p className="image-link" title={image.name}>
                                                {image.name}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {images.length === 0 && !isLoading && <p>Thư mục này trống. Hãy tải lên vài tấm ảnh!</p>}
                            {totalPages > 1 && (
                                <div className="pagination">
                                    <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>Trước</button>
                                    <span>Trang {currentPage} / {totalPages}</span>
                                    <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>Sau</button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="placeholder">
                            <p>Tạo hoặc chọn một thư mục để bắt đầu.</p>
                        </div>
                    )}
                </section>
            </main>
            <Notification message={notification?.message ?? null} type={notification?.type ?? 'success'} onEnd={() => setNotification(null)} />
        </>
    );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);