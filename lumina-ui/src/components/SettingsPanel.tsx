import { X } from 'lucide-react';
import styles from './SettingsPanel.module.css';

interface Props { onClose: () => void; }

export default function SettingsPanel({ onClose }: Props) {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>Settings</span>
        <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
      </div>
      <div className={styles.body}>
        <section className={styles.section}>
          <div className={styles.sectionLabel}>API Keys</div>
          <label className={styles.label}>Gemini API Key</label>
          <input type="password" className={styles.input} placeholder="AIza..." />
          <label className={styles.label}>Anthropic API Key</label>
          <input type="password" className={styles.input} placeholder="sk-ant-..." />
          <label className={styles.label}>OpenAI / OpenRouter Key</label>
          <input type="password" className={styles.input} placeholder="sk-..." />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionLabel}>Default Model</div>
          <select className={styles.input}>
            <option>gemini-2.0-flash</option>
            <option>claude-sonnet-4-5</option>
            <option>gpt-4o</option>
            <option>mistralai/mistral-7b-instruct</option>
          </select>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionLabel}>Provider</div>
          <div className={styles.radioGroup}>
            {['Google-GenAI', 'Anthropic', 'OpenAI'].map(p => (
              <label key={p} className={styles.radioLabel}>
                <input type="radio" name="provider" defaultChecked={p === 'Google-GenAI'} />
                <span>{p}</span>
              </label>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionLabel}>MCP Servers</div>
          {[
            { name: 'AutoGUI MCP', on: true },
            { name: 'Shell MCP', on: true },
            { name: 'Orchestrator', on: false },
          ].map(s => (
            <div key={s.name} className={styles.toggleRow}>
              <span>{s.name}</span>
              <label className={styles.toggle}>
                <input type="checkbox" defaultChecked={s.on} />
                <span className={styles.slider} />
              </label>
            </div>
          ))}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionLabel}>Notifications</div>
          {['Agent connect/disconnect', 'Tool execution errors', 'Session restore'].map(item => (
            <div key={item} className={styles.toggleRow}>
              <span>{item}</span>
              <label className={styles.toggle}>
                <input type="checkbox" defaultChecked />
                <span className={styles.slider} />
              </label>
            </div>
          ))}
        </section>

        <button className={styles.saveBtn}>Save Changes</button>
      </div>
    </div>
  );
}
