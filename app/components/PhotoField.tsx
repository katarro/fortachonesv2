'use client';

import { useRef, useState, useImperativeHandle, forwardRef } from 'react';

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export interface PhotoFieldRef {
  value: string | null;
  set(value: string | null): void;
  reset(): void;
}

interface Props {
  inputId: string;
}

const PhotoField = forwardRef<PhotoFieldRef, Props>(function PhotoField({ inputId }, ref) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    get value() { return value; },
    set(v: string | null) {
      setValue(v);
      setError(null);
      if (fileRef.current) fileRef.current.value = '';
    },
    reset() {
      setValue(null);
      setError(null);
      if (fileRef.current) fileRef.current.value = '';
    },
  }));

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Ese archivo no es una imagen. Elige un JPG, PNG o similar.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError('La foto pesa más de 8 MB. Elige una más liviana.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setValue(reader.result as string);
      if (fileRef.current) fileRef.current.value = '';
    };
    reader.onerror = () => setError('No se pudo leer la foto. Intenta con otra.');
    reader.readAsDataURL(file);
  }

  return (
    <div className="photo-field">
      {!value ? (
        <label className="photo-drop" htmlFor={inputId}>
          <svg className="icon" aria-hidden="true"><use href="#i-camera"/></svg>
          <span>Subir o tomar una foto</span>
          <input
            ref={fileRef}
            className="photo-input"
            id={inputId}
            type="file"
            accept="image/*"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      ) : (
        <div className="photo-preview">
          <img src={value} alt="Vista previa de la foto" />
          <button className="photo-remove" type="button" onClick={() => { setValue(null); }}>
            Quitar
          </button>
        </div>
      )}
      {error && <p className="photo-error" role="alert">{error}</p>}
    </div>
  );
});

export default PhotoField;
