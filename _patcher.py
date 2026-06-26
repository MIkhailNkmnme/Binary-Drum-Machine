import os
import re
import shutil
from datetime import datetime
import sys
import time
import builtins
from collections import Counter

try:
    import msvcrt
except ImportError:
    msvcrt = None

PROMPT_FILE_PREFIX = "ai_studio_code"
VERSIONS_DIR = "_Versions"
TRASH_DIR = "_Versions_patcher"

iteration_log = []
accumulate_log = False
_original_print = builtins.print

def print(*args, **kwargs):
    sep = kwargs.get('sep', ' ')
    message = sep.join(map(str, args))
    _original_print(*args, **kwargs)
    if accumulate_log:
        iteration_log.append(message)

def copy_to_clipboard(text):
    if sys.platform == 'win32':
        try:
            import subprocess
            proc = subprocess.Popen(['clip'], stdin=subprocess.PIPE, shell=True)
            proc.communicate(input=text.encode('utf-16'))
            if proc.returncode == 0: return True
        except Exception: pass
    try:
        import tkinter as tk
        root = tk.Tk()
        root.withdraw()
        root.clipboard_clear()
        root.clipboard_append(text)
        root.update()
        root.destroy()
        return True
    except Exception: pass
    return False

def bring_to_foreground():
    if sys.platform == 'win32':
        try:
            import ctypes
            hwnd = ctypes.windll.kernel32.GetConsoleWindow()
            if hwnd:
                ctypes.windll.user32.ShowWindow(hwnd, 9)
                ctypes.windll.user32.SetForegroundWindow(hwnd)
        except Exception: pass

def read_keyboard_command():
    if msvcrt and sys.platform == 'win32':
        try:
            if msvcrt.kbhit():
                char = msvcrt.getch()
                if char in [b'\x00', b'\xe0']:
                    if msvcrt.kbhit(): msvcrt.getch()
                    return "trigger"
                
                decoded_char = ""
                for enc in ['utf-8', 'cp866', 'cp1251']:
                    try:
                        decoded_char = char.decode(enc).lower()
                        break
                    except Exception: pass
                
                if decoded_char in ['b', 'и', 'б']:
                    return "restore"
                return "trigger"
        except Exception: pass
    return None

def get_clipboard_text():
    try:
        import tkinter as tk
        root = tk.Tk()
        root.withdraw()
        text = root.clipboard_get()
        root.destroy()
        if text: return text
    except Exception: pass

    if sys.platform == 'win32':
        try:
            import subprocess
            proc = subprocess.Popen(['powershell', '-NoProfile', '-Command', 'Get-Clipboard'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, creationflags=0x08000000)
            out, err = proc.communicate(timeout=2)
            if proc.returncode == 0 and out:
                return out.strip('\r\n')
        except Exception: pass
    return None

def get_manual_prompt_input():
    _original_print("\n📋 Чтение промпта напрямую из буфера обмена...")
    text = get_clipboard_text()
    if text:
        content = text.replace('\r\n', '\n').strip()
        if content.lower() == "b" or "replace with:" in content.lower() or ("replace" + "_block:") in content.lower():
            _original_print("✅ Код успешно получен из буфера!")
            return content
    _original_print("❌ В буфере обмена не обнаружен промпт для патчера.")
    return None

def find_target_filename(prompt_text):
    match = re.search(r'(?:edit file|file|файл)[:\s]+[`\'"]?([a-zA-Z0-9_-]+\.(?:html|js|css|py|txt))[`\'"]?', prompt_text, re.IGNORECASE)
    if match: return match.group(1)
    return None

def resolve_versioned_filename(target_file):
    if os.path.exists(target_file): return target_file
    base, ext = os.path.splitext(target_file)
    pattern_re = re.compile(rf"^{re.escape(base)}_v(\d+){re.escape(ext)}$", re.IGNORECASE)
    candidates = []
    for f in os.listdir('.'):
        match = pattern_re.match(f)
        if match: candidates.append((int(match.group(1)), f))
    if candidates:
        candidates.sort()
        best_match = candidates[-1][1]
        print(f"ℹ️ Исходный файл не найден, используем версию: '{best_match}'")
        return best_match
    return target_file

def find_and_read_prompt():
    for f in os.listdir('.'):
        if f.lower().startswith(PROMPT_FILE_PREFIX.lower()) and os.path.isfile(f):
            try:
                if os.path.getsize(f) > 0:
                    content = ""
                    for enc in ['utf-8-sig', 'utf-16', 'windows-1251']:
                        try:
                            with open(f, 'r', encoding=enc) as file:
                                test_content = file.read().replace('\r\n', '\n')
                                if '\x00' in test_content: continue
                                content = test_content.replace('\ufeff', '').strip()
                                break
                        except Exception: continue
                    if content: return f, content
            except Exception: continue
    return None, None

def move_prompt_file_to_trash(filepath):
    try:
        if not os.path.exists(TRASH_DIR): os.makedirs(TRASH_DIR)
        base_name = os.path.basename(filepath)
        name, ext = os.path.splitext(base_name)
        new_name = f"{name}_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}{ext}"
        dest_path = os.path.join(TRASH_DIR, new_name)
        shutil.move(filepath, dest_path)
        print(f"📦 Промпт архивирован: '{dest_path}'")
    except Exception as e:
        print(f"⚠️ Ошибка перемещения: {e}")

def save_version_and_history(target_file, prompt_content):
    if not os.path.exists(VERSIONS_DIR): os.makedirs(VERSIONS_DIR)
    file_dir = os.path.join(VERSIONS_DIR, target_file)
    if not os.path.exists(file_dir): os.makedirs(file_dir)
    base, ext = os.path.splitext(target_file)
    
    version_str = ""
    try:
        content = ""
        for enc in ['utf-8', 'windows-1251']:
            try:
                with open(target_file, 'r', encoding=enc) as f:
                    content = f.read()
                    break
            except Exception:
                continue
        
        # Динамически ищем версию проекта в файле (например, v0.67 Golden Master)
        match = re.search(r'Zerkalius:\s*Genesis\s*\(v(\d+\.\d+|\d+)\s*Golden\s*Master\)', content, re.IGNORECASE)
        if match:
            raw_ver = match.group(1) # Например, "0.67"
            # Очищаем от точек, превращая "0.67" -> "067"
            cleaned_ver = "".join(c for c in raw_ver if c.isdigit())
            if len(cleaned_ver) == 2:
                version_str = f"0{cleaned_ver}"
            elif len(cleaned_ver) >= 3:
                version_str = cleaned_ver
            else:
                version_str = cleaned_ver.zfill(3)
    except Exception:
        pass

    if not version_str:
        existing_files = [f for f in os.listdir(file_dir) if f.startswith(base + '_v') and f.endswith(ext)]
        version_num = len(existing_files) + 1
        version_str = f"{version_num:03d}"
    
    backup_name = f"{base}_v{version_str}{ext}"
    backup_path = os.path.join(file_dir, backup_name)
    shutil.copy(target_file, backup_path)
    shutil.copy(target_file, target_file + ".bak")
    
    history_file = os.path.join(file_dir, "_history_prompts.txt")
    with open(history_file, 'a', encoding='utf-8-sig') as f:
        f.write(f"\n{'='*60}\n⏱ Версия: v_{version_str} | Дата: {datetime.now().strftime('%d-%m-%Y_%H-%M-%S')}\n{'-'*60}\n{prompt_content.strip()}\n")
    print(f"💾 Версия v{version_str} сохранена.")

def clean_md_blocks(text):
    """Умная очистка блоков кода от маркдауна."""
    lines = text.strip('\n').split('\n')
    if lines and lines[0].strip().startswith('```'):
        lines.pop(0)
    if lines and lines[-1].strip().startswith('```'):
        lines.pop(-1)
    return '\n'.join(lines).strip('\n')

def apply_patch():
    global accumulate_log, iteration_log
    last_target_file = None
    waiting_msg_shown = False
    
    _original_print("🚀 Запуск SUPER-патчера Zerkalius (v6 Post-Check Protection)...")
    _original_print("👉 Нажмите любую клавишу для вставки промпта из буфера.\n")
    
    while True:
        prompt_file = None
        prompt_content = None
        
        kb_cmd = read_keyboard_command()
        if kb_cmd:
            waiting_msg_shown = False
            if kb_cmd == "restore":
                prompt_content = "b"
                prompt_file = "KEYBOARD_CMD"
            else:
                prompt_content = get_manual_prompt_input()
                if not prompt_content: continue
                prompt_file = "MANUAL_INPUT"
            
        if not prompt_content:
            prompt_file, prompt_content = find_and_read_prompt()
            
        if not prompt_content:
            if not waiting_msg_shown:
                _original_print("🔍 Ожидание промпта...")
                waiting_msg_shown = True
            time.sleep(1)
            continue
            
        waiting_msg_shown = False
        bring_to_foreground()
        iteration_log.clear()
        accumulate_log = True
        has_errors = False
        
        print(f"🎯 Источник промпта: {prompt_file}")

        if prompt_content.strip().lower() == "b":
            bak_files = [f for f in os.listdir('.') if f.endswith('.bak')]
            if bak_files:
                bak_files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
                shutil.copy(bak_files[0], bak_files[0][:-4])
                print(f"✅ Восстановлен бэкап '{bak_files[0]}'")
            else:
                print("❌ Бэкап не найден.")
            if prompt_file not in ["MANUAL_INPUT", "KEYBOARD_CMD"]:
                move_prompt_file_to_trash(prompt_file)
            accumulate_log = False
            continue

        target_file = find_target_filename(prompt_content) or last_target_file
        if not target_file:
            print("❌ Файл не указан.")
            if prompt_file not in ["MANUAL_INPUT", "KEYBOARD_CMD"]:
                move_prompt_file_to_trash(prompt_file)
            accumulate_log = False
            continue
            
        last_target_file = target_file
        target_file = resolve_versioned_filename(target_file)

        if not os.path.exists(target_file):
            print(f"❌ Файл '{target_file}' не найден!")
            if prompt_file not in ["MANUAL_INPUT", "KEYBOARD_CMD"]:
                move_prompt_file_to_trash(prompt_file)
            accumulate_log = False
            continue

        try:
            with open(target_file, 'r', encoding='utf-8') as f: html_content = f.read().replace('\r\n', '\n')
        except:
            with open(target_file, 'r', encoding='windows-1251') as f: html_content = f.read().replace('\r\n', '\n')

        # Предварительное сканирование на конфликтные дубликаты перед записью бэкапа
        block_pattern = re.compile(r'REPLACE' + r'_BLOCK:\s*(.*?)\n(.*?)\nEND' + r'_BLOCK:\s*(.*?)(?=\n(?:REPLACE' + r'_BLOCK|FIND)|\Z)', re.DOTALL)
        pattern = re.compile(r'FIND:\s*\n(.*?)\nREPLACE WITH:\s*\n(.*?)(?=\n+(?:\s*?)FIND:|\Z)', re.DOTALL)
        
        has_duplicate_issues = False

        for start_m, new_code, end_m in block_pattern.findall(prompt_content):
            start_m_clean = start_m.strip()
            count = html_content.count(start_m_clean)
            if count > 1:
                print(f"⚠️ ПРЕ-ПРОВЕРКА: Маркер '{start_m_clean}' встречается в файле {count} раз(а)!")
                has_duplicate_issues = True

        for i, (find_text, replace_text) in enumerate(pattern.findall(prompt_content), 1):
            find_clean = clean_md_blocks(find_text)
            count = html_content.count(find_clean)
            if count > 1:
                print(f"⚠️ ПРЕ-ПРОВЕРКА: Блок FIND {i} совпадает в коде в {count} разных местах!")
                has_duplicate_issues = True

        if has_duplicate_issues:
            print("🛑 ПРИОСТАНОВКА: В целевом файле найдены конфликты разметки!")
            print("👉 Пожалуйста, очистите дубликаты вручную или восстановите рабочую версию, введя 'b'.")
            if prompt_file != "MANUAL_INPUT": move_prompt_file_to_trash(prompt_file)
            accumulate_log = False
            continue

        save_version_and_history(target_file, prompt_content)

        # 1. ОБРАБОТКА БЛОКОВ ПО МАРКЕРАМ
        block_matches = block_pattern.findall(prompt_content)
        success_count = 0
        
        for i, (start_m, new_code, end_m) in enumerate(block_matches, 1):
            start_esc = re.escape(start_m.strip())
            end_esc = re.escape(end_m.strip())
            regex = re.compile(rf'({start_esc}).*?({end_esc})', re.DOTALL)
            
            if regex.search(html_content):
                cleaned_code = clean_md_blocks(new_code)
                code_lines = cleaned_code.split('\n')
                
                start_m_clean = start_m.strip()
                end_m_clean = end_m.strip()
                while code_lines and (start_m_clean in code_lines[0] or 'REPLACE_BLOCK' in code_lines[0]):
                    code_lines.pop(0)
                while code_lines and (end_m_clean in code_lines[-1] or 'END_BLOCK' in code_lines[-1]):
                    code_lines.pop(-1)
                    
                cleaned_code = '\n'.join(code_lines)
                html_content = regex.sub(lambda m: f"{m.group(1)}\n{cleaned_code}\n{m.group(2)}", html_content, count=1)
                print(f"✅ Успешно заменен целый БЛОК: '{start_m.strip()}' -> '{end_m.strip()}'.")
                success_count += 1
            else:
                print(f"❌ ОШИБКА: Не удалось найти маркеры '{start_m.strip()}' и '{end_m.strip()}'.")
                has_errors = True

        # 2. ОБРАБОТКА ОБЫЧНЫХ FIND/REPLACE
        matches = pattern.findall(prompt_content)
        for i, (find_text, replace_text) in enumerate(matches, 1):
            find_text = clean_md_blocks(find_text)
            replace_text = clean_md_blocks(replace_text)

            if find_text in html_content:
                html_content = html_content.replace(find_text, replace_text, 1)
                print(f"✅ Шаг FIND/REPLACE {i}: Успешно (точное совпадение).")
                success_count += 1
                continue

            html_lines = html_content.split('\n')
            find_lines = find_text.split('\n')
            target_stripped = [line.strip() for line in html_lines]
            find_stripped = [line.strip() for line in find_lines]
            
            match_idx = -1
            n_find = len(find_stripped)
            n_target = len(target_stripped)
            
            for idx in range(n_target - n_find + 1):
                if target_stripped[idx : idx + n_find] == find_stripped:
                    match_idx = idx
                    break
            
            if match_idx != -1:
                html_lines[match_idx : match_idx + n_find] = [replace_text]
                html_content = '\n'.join(html_lines)
                print(f"✅ Шаг FIND/REPLACE {i}: Успешно (игнорируя отступы).")
                success_count += 1
                continue

            escaped_words = [re.escape(w) for w in find_text.split()]
            if escaped_words:
                regex_pattern = r'\s+'.join(escaped_words)
                match = re.search(regex_pattern, html_content)
                if match:
                    html_content = html_content[:match.start()] + replace_text + html_content[match.end():]
                    print(f"✅ Шаг FIND/REPLACE {i}: Успешно (Regex God-Mode).")
                    success_count += 1
                    continue

            print(f"❌ Шаг FIND/REPLACE {i}: Блок НЕ НАЙДЕН!")
            has_errors = True

        if success_count > 0:
            # --- 🛡️ ПОСТ-ПРОВЕРКА НА ДУБЛИКАТЫ (POST-CHECK) ---
            post_warnings = []
            
            # Проверка 1: дубликаты маркеров (считаем все маркеры вида <!-- === МАРКЕР: ... === -->)
            all_markers = re.findall(r'<!-- === МАРКЕР:.*?=== -->', html_content)
            marker_counts = Counter(all_markers)
            for m_name, count in marker_counts.items():
                if count > 1:
                    post_warnings.append(f"Дубликат маркера ({count} шт.): {m_name}")
            
                # Проверка 2: артефакты от ИИ, влезшие в итоговый файл
                if ("REPLACE" + "_BLOCK:") in html_content:
                    post_warnings.append("Артефакт ИИ: найдено слово '" + "REPLACE" + "_BLOCK:' в итоговом файле!")
                if ("END" + "_BLOCK:") in html_content:
                    post_warnings.append("Артефакт ИИ: найдено слово '" + "END" + "_BLOCK:' в итоговом файле!")

            # Запись файла в любом случае
            with open(target_file, 'w', encoding='utf-8') as f: f.write(html_content)
            
            total_expected = len(block_matches) + len(matches)
            if success_count == total_expected:
                print(f"\n🔥 СУПЕР! Применено {success_count} патчей из {total_expected} — ВСЕ ПАТЧИ ВНЕДРЕНЫ!!!!!! 🏁🏁")
            else:
                print(f"\n⚠️ ВНИМАНИЕ: Применено только {success_count} из {total_expected} патчей! (Часть шагов пропущена)")

            # Обработка результатов пост-проверки
            if post_warnings:
                print("\n" + "!"*60)
                print("⚠️ ВНИМАНИЕ! ПОСЛЕ ПАТЧИНГА ОБНАРУЖЕНЫ АНОМАЛИИ В КОДЕ:")
                for w in post_warnings:
                    print(f"  - {w}")
                print("👉 Нажмите клавишу 'b' ПРЯМО СЕЙЧАС для отката (rollback) к предыдущей версии!")
                print("!"*60)
                has_errors = True # Принудительно вызываем копирование лога в буфер

        if prompt_file != "MANUAL_INPUT": move_prompt_file_to_trash(prompt_file)
        
        accumulate_log = False
        if has_errors:
            log_text = "\n".join(iteration_log)
            if copy_to_clipboard("============================================================\n" + log_text + "\n============================================================"):
                _original_print("📋 Лог ошибок скопирован в буфер!")
        _original_print("="*60 + "\n")

if __name__ == "__main__":
    apply_patch()