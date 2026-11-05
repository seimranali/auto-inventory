import { createContext, useContext, useRef, useState } from 'react';
import { fileUrl } from '../api';
import Button from './Button';
import NavIcon from './NavIcon';

const LightboxCtx = createContext(() => {});
export const useLightbox = () => useContext(LightboxCtx);

export function LightboxProvider({ children }) {
  const [src, setSrc] = useState(null);
  return (
    <LightboxCtx.Provider value={setSrc}>
      {children}
      {src && <div id="lightbox" onClick={() => setSrc(null)}><img src={src} alt="" /></div>}
    </LightboxCtx.Provider>
  );
}

// Click or drag-and-drop file picker
export function FileDropzone({ onFiles, accept = 'image/*', multiple = true, label = 'Drop images here or click to browse', busy }) {
  const ref = useRef();
  const [over, setOver] = useState(false);
  const pick = list => { const files = [...list]; if (files.length) onFiles(multiple ? files : files[0]); };
  return (
    <div
      className={`dropzone no-print ${over ? 'over' : ''}`}
      onClick={() => ref.current.click()}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files); }}
    >
      {busy ? 'Uploading…' : label}
      <input ref={ref} type="file" hidden accept={accept} multiple={multiple} onChange={e => { pick(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

// images: [{ id, file_name }]; first image is the cover
export function ImageGallery({ images, onDelete, onCover }) {
  const open = useLightbox();
  if (!images?.length) return <div className="muted">No images uploaded.</div>;
  return (
    <div className="gallery">
      {images.map((img, i) => (
        <figure key={img.id}>
          {i === 0 && <span className="cover-tag">Cover</span>}
          <img src={fileUrl(img.file_name)} alt="" onClick={() => open(fileUrl(img.file_name))} />
          {(onDelete || onCover) && (
            <div className="tools no-print">
              {onCover && i > 0 && <Button onClick={() => onCover(img)}>Set cover</Button>}
              {onDelete && <Button variant="danger" onClick={() => onDelete(img)}>Delete</Button>}
            </div>
          )}
        </figure>
      ))}
    </div>
  );
}

// Image or PDF preview of a single stored document
export function DocumentPreview({ name }) {
  const open = useLightbox();
  if (!name) return null;
  const url = fileUrl(name);
  if (name.endsWith('.pdf')) return <iframe className="pdf-frame" src={url} title="Document" />;
  return <img className="sheet-img" src={url} alt="Document" onClick={() => open(url)} />;
}

export function Thumb({ name }) {
  if (name) return <img className="thumb" src={fileUrl(name)} alt="" loading="lazy" />;
  return (
    <span className="thumb thumb-empty" title="No photo">
      <NavIcon name="inventory" size={20} />
    </span>
  );
}
