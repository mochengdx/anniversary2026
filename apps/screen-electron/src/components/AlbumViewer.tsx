import { useState, useEffect, useRef, useCallback } from 'react';

export interface Photo {
  id: string;
  url: string;
  path: string;
  desc: string;
}

export interface Album {
  id: string;
  name: string;
  desc: string;
  photos: Photo[];
  coverUrl?: string;
}

export function AlbumViewer() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [viewMode, setViewMode] = useState<'LIST' | 'ALBUM' | 'PLAY'>('LIST');
  const [currentAlbumId, setCurrentAlbumId] = useState<string | null>(null);

  // Modals state
  const [isAlbumModalOpen, setIsAlbumModalOpen] = useState(false);
  const [editAlbumInfo, setEditAlbumInfo] = useState<{name: string; desc: string}>({ name: '', desc: '' });
  
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [editPhotoInfo, setEditPhotoInfo] = useState<{id: string; desc: string}>({ id: '', desc: '' });

  // Playback state
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [showBanner, setShowBanner] = useState(false);
  const [playState, setPlayState] = useState<'BANNER' | 'PHOTO'>('BANNER');
  const [animationClass, setAnimationClass] = useState('zoom-in');

  useEffect(() => {
    loadAlbums();
  }, []);

  const loadAlbums = async () => {
    if (window.electronAPI && window.electronAPI.getAlbums) {
      const data = await window.electronAPI.getAlbums();
      setAlbums(data || []);
    }
  };

  const saveAlbums = async (newAlbums: Album[]) => {
    setAlbums(newAlbums);
    if (window.electronAPI && window.electronAPI.saveAlbums) {
      await window.electronAPI.saveAlbums(newAlbums);
    }
  };

  // -------------------------
  // Album Actions
  // -------------------------
  const handleCreateAlbumClick = () => {
    setEditAlbumInfo({ name: '', desc: '' });
    setIsAlbumModalOpen(true);
  };

  const handleSaveAlbum = () => {
    if (!editAlbumInfo.name.trim()) return;
    const newAlbum: Album = {
      id: Date.now().toString(),
      name: editAlbumInfo.name,
      desc: editAlbumInfo.desc,
      photos: []
    };
    saveAlbums([...albums, newAlbum]);
    setIsAlbumModalOpen(false);
  };

  const handleDeleteAlbum = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这个相册吗？')) {
      const newAlbums = albums.filter(a => a.id !== id);
      saveAlbums(newAlbums);
    }
  };

  const openAlbum = (id: string) => {
    setCurrentAlbumId(id);
    setViewMode('ALBUM');
  };

  // -------------------------
  // Photo Actions
  // -------------------------
  const handleAddPhotos = async () => {
    if (!window.electronAPI || !currentAlbumId) return;
    // We already have selectAlbumDirectory, maybe we can reuse it to select a folder, 
    // or select multiple files. Let's use selectAlbumDirectory to import a whole folder of photos into current album.
    const dirPath = await window.electronAPI.selectAlbumDirectory();
    if (!dirPath) return;
    const files = await window.electronAPI.readAlbumFiles(dirPath);
    if (!files || files.length === 0) return;

    const newPhotos: Photo[] = files.map((f: any) => ({
      id: Date.now() + Math.random().toString(),
      url: f.url,
      path: f.path,
      desc: ''
    }));

    const newAlbums = albums.map(a => {
      if (a.id === currentAlbumId) {
        return { 
          ...a, 
          photos: [...a.photos, ...newPhotos],
          coverUrl: a.coverUrl || newPhotos[0]?.url 
        };
      }
      return a;
    });
    saveAlbums(newAlbums);
  };

  const handleEditPhotoClick = (e: React.MouseEvent, photo: Photo) => {
    e.stopPropagation();
    setEditPhotoInfo({ id: photo.id, desc: photo.desc || '' });
    setIsPhotoModalOpen(true);
  };

  const handleSavePhotoDesc = () => {
    const newAlbums = albums.map(a => {
      if (a.id === currentAlbumId) {
        return {
          ...a,
          photos: a.photos.map(p => p.id === editPhotoInfo.id ? { ...p, desc: editPhotoInfo.desc } : p)
        };
      }
      return a;
    });
    saveAlbums(newAlbums);
    setIsPhotoModalOpen(false);
  };

  const handleDeletePhoto = (e: React.MouseEvent, photoId: string) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这张照片吗？')) {
      const newAlbums = albums.map(a => {
        if (a.id === currentAlbumId) {
          const newPhotos = a.photos.filter(p => p.id !== photoId);
          return { ...a, photos: newPhotos, coverUrl: newPhotos.length > 0 ? newPhotos[0].url : undefined };
        }
        return a;
      });
      saveAlbums(newAlbums);
    }
  };

  // -------------------------
  // Playback Logic
  // -------------------------
  const startPlayback = () => {
    setViewMode('PLAY');
    setPlaybackIndex(0);
    setPlayState('BANNER');
    setShowBanner(true);
    
    // Show banner for 3 seconds, then start photos
    setTimeout(() => {
      setShowBanner(false);
      setTimeout(() => {
        setPlayState('PHOTO');
        setAnimationClass('zoom-in');
      }, 800);
    }, 4000);
  };

  const playStateRef = useRef(playState);
  const playbackIndexRef = useRef(playbackIndex);
  
  useEffect(() => {
    playStateRef.current = playState;
    playbackIndexRef.current = playbackIndex;
  }, [playState, playbackIndex]);

  useEffect(() => {
    let timer: any;
    if (viewMode === 'PLAY' && playState === 'PHOTO') {
      const currentAlbum = albums.find(a => a.id === currentAlbumId);
      if (!currentAlbum || currentAlbum.photos.length === 0) return;

      timer = setInterval(() => {
        setPlaybackIndex(prev => {
          const next = (prev + 1) % currentAlbum.photos.length;
          return next;
        });
        // Randomize the ken burns animation class
        const classes = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right'];
        setAnimationClass(classes[Math.floor(Math.random() * classes.length)]);
      }, 7000); // switch every 7 seconds
    }
    return () => clearInterval(timer);
  }, [viewMode, playState, currentAlbumId, albums]);


  const currentAlbum = albums.find(a => a.id === currentAlbumId);

  return (
    <>
      {viewMode !== 'PLAY' && (
        <div className="album-manager">
          
          {/* LIST MODE */}
          {viewMode === 'LIST' && (
            <>
              <div className="album-header">
                <h2>我的相册</h2>
                <button className="primary-btn" onClick={handleCreateAlbumClick} style={{ padding: '10px 20px', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                  + 新建相册
                </button>
              </div>
              <div className="album-grid">
                {albums.map(album => (
                  <div key={album.id} className="album-card" onClick={() => openAlbum(album.id)}>
                    {album.coverUrl ? (
                      <img src={album.coverUrl} alt="cover" />
                    ) : (
                      <div style={{width:'100%', height:'180px', background:'rgba(255,255,255,0.1)', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'10px'}}>无照片</div>
                    )}
                    <div className="album-card-title">{album.name}</div>
                    <div className="album-card-desc">{album.desc || '暂无描述'} ({album.photos?.length || 0}张)</div>
                    <div className="album-actions">
                      <button onClick={(e) => handleDeleteAlbum(e, album.id)}>删除相册</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ALBUM MODE */}
          {viewMode === 'ALBUM' && currentAlbum && (
            <>
              <div className="album-header">
                <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                  <button onClick={() => setViewMode('LIST')} style={{padding:'8px 16px', background:'rgba(255,255,255,0.1)', border:'none', color:'white', borderRadius:'6px', cursor:'pointer'}}>返回</button>
                  <div>
                    <h2 style={{margin:0}}>{currentAlbum.name}</h2>
                    <p style={{margin:0, fontSize:'14px', color:'#aaa', marginTop:'4px'}}>{currentAlbum.desc}</p>
                  </div>
                </div>
                <div style={{display:'flex', gap:'12px'}}>
                  <button onClick={handleAddPhotos} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                    + 导入图片(选取文件夹)
                  </button>
                  {currentAlbum.photos.length > 0 && (
                    <button onClick={startPlayback} style={{ padding: '10px 20px', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                      ▶ 播放相册
                    </button>
                  )}
                </div>
              </div>

              <div className="album-grid">
                {currentAlbum.photos.map((photo) => (
                  <div key={photo.id} className="photo-card" onDoubleClick={(e) => handleEditPhotoClick(e, photo)}>
                    <img src={photo.url} alt="photo" />
                    <div className="photo-desc-overlay">{photo.desc || '双击添加描述'}</div>
                    <div className="album-actions">
                      <button onClick={(e) => handleEditPhotoClick(e, photo)}>编辑描述</button>
                      <button onClick={(e) => handleDeletePhoto(e, photo.id)}>删除</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

        </div>
      )}

      {/* PLAYBACK MODE */}
      {viewMode === 'PLAY' && currentAlbum && (
        <div className="album-player">
          <button className="album-player-close" onClick={() => setViewMode('ALBUM')}>退出播放</button>

          {/* Banner Phase */}
          <div className={`album-player-banner ${showBanner ? 'active' : ''}`}>
            <h1>{currentAlbum.name}</h1>
            <p>{currentAlbum.desc}</p>
          </div>

          {/* Photo Phase */}
          {playState === 'PHOTO' && currentAlbum.photos.length > 0 && (
            <div className={`photo-slide active ${animationClass}`}>
              <img className="photo-slide-bg" src={currentAlbum.photos[playbackIndex].url} alt="" />
              <img className="photo-slide-img" src={currentAlbum.photos[playbackIndex].url} alt="" />
            </div>
          )}
          
          {/* Photo Description overlay */}
          {playState === 'PHOTO' && currentAlbum.photos.length > 0 && currentAlbum.photos[playbackIndex].desc && (
            <div key={`desc-${playbackIndex}`} className="player-photo-desc">
              {currentAlbum.photos[playbackIndex].desc}
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      {isAlbumModalOpen && (
        <div className="album-modal-overlay">
          <div className="album-modal">
            <h3>新建相册</h3>
            <input 
              placeholder="相册名称" 
              value={editAlbumInfo.name} 
              onChange={e => setEditAlbumInfo({...editAlbumInfo, name: e.target.value})} 
            />
            <textarea 
              placeholder="相册描述 (可选)" 
              value={editAlbumInfo.desc} 
              onChange={e => setEditAlbumInfo({...editAlbumInfo, desc: e.target.value})} 
            />
            <div className="album-modal-actions">
              <button onClick={() => setIsAlbumModalOpen(false)}>取消</button>
              <button className="primary" onClick={handleSaveAlbum}>保存</button>
            </div>
          </div>
        </div>
      )}

      {isPhotoModalOpen && (
        <div className="album-modal-overlay">
          <div className="album-modal">
            <h3>编辑照片描述</h3>
            <textarea 
              placeholder="输入描述内容，播放时将展示在右下角" 
              value={editPhotoInfo.desc} 
              onChange={e => setEditPhotoInfo({...editPhotoInfo, desc: e.target.value})} 
              autoFocus
            />
            <div className="album-modal-actions">
              <button onClick={() => setIsPhotoModalOpen(false)}>取消</button>
              <button className="primary" onClick={handleSavePhotoDesc}>保存</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
