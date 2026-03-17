export default function PathPicker({ label, value, onChange, onBrowse, placeholder, disabled }) {
  return (
    <div className="form-group full-width">
      <label className="form-label">{label}</label>
      <div className="field-row">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
        <button
          className="btn-icon"
          onClick={onBrowse}
          disabled={disabled}
          title="Browse"
        >
          ...
        </button>
      </div>
    </div>
  );
}
