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

def flush_keyboard_input():
    """Полностью очищает буфер клавиатурного ввода во избежание зацикливания."""
    if msvcrt and sys.platform == 'win32':
        try:
            while msvcrt.kbhit():
                msvcrt.getch()
        except Exception: pass

def read_keyboard_command():
    if msvcrt and sys.platform == 'win32':
        try:
            if msvcrt.kbhit():
                char = msvcrt.getch()
                if char in [b'\x00', b'\xe0']:
                    if msvcrt.kbhit(): msvcrt.getch()
                    flush_keyboard_input()
                    return "trigger"
                decoded_char = ""
                for enc in ['utf-8', 'cp866', 'cp1251']:
                    try:
                        decoded_char = char.decode(enc).lower()
                        break
                    except Exception: pass
                
                # Сбрасываем все последующие символы, попавшие в буфер (например, при вставке)
                flush_keyboard_input()
                
                if decoded_char in ['b', 'и', 'б']: return "restore"
                return "trigger"
        except Exception: pass
    return None

def get_clipboard_text():
    # Метод 1: ctypes/winapi напрямую — без зависимостей, самый надёжный
    if sys.platform == 'win32':
        try:
            import ctypes
            import ctypes.wintypes
            CF_UNICODETEXT = 13
            u32 = ctypes.windll.user32
            k32 = ctypes.windll.kernel32
            if u32.OpenClipboard(None):
                try:
                    h = u32.GetClipboardData(CF_UNICODETEXT)
                    if h:
                        ptr = k32.GlobalLock(h)
                        if ptr:
                            try:
                                text = ctypes.wstring_at(ptr)
                                if text:
                                    _original_print("  [буфер: ctypes/winapi]")
                                    return text
                            finally:
                                k32.GlobalUnlock(h)
                finally:
                    u32.CloseClipboard()
        except Exception as e:
            _original_print(f"  [ctypes ошибка: {e}]")

    # Метод 2: win32clipboard
    if sys.platform == 'win32':
        try:
            import win32clipboard
            import win32con
            win32clipboard.OpenClipboard()
            try:
                if win32clipboard.IsClipboardFormatAvailable(win32con.CF_UNICODETEXT):
                    text = win32clipboard.GetClipboardData(win32con.CF_UNICODETEXT)
                    if text:
                        _original_print("  [буфер: win32clipboard]")
                        return text
            finally:
                win32clipboard.CloseClipboard()
        except ImportError:
            pass
        except Exception as e:
            _original_print(f"  [win32clipboard ошибка: {e}]")

    # Метод 3: PowerShell с явной кодировкой UTF-8
    if sys.platform == 'win32':
        try:
            import subprocess
            cmd = (
                'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass '
                '-Command "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; '
                'Get-Clipboard"'
            )
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                creationflags=0x08000000,
                shell=True
            )
            out, err = proc.communicate(timeout=5)
            text = out.decode('utf-8', errors='replace').strip('\r\n')
            if proc.returncode == 0 and text:
                _original_print("  [буфер: powershell]")
                return text
        except Exception as e:
            _original_print(f"  [powershell ошибка: {e}]")

    # Метод 4: tkinter — последний резерв
    try:
        import tkinter as tk
        root = tk.Tk()
        root.withdraw()
        try:
            text = root.clipboard_get()
            if text:
                _original_print("  [буфер: tkinter]")
                return text
        finally:
            root.destroy()
    except Exception as e:
        _original_print(f"  [tkinter ошибка: {e}]")

    return None

def get_manual_prompt_input():
    _original_print("\n📋 Чтение промпта из буфера обмена...")
    # Небольшая пауза — буфер может не успеть обновиться сразу после нажатия клавиши
    time.sleep(0.3)
    
    # До 3 попыток с паузой между ними
    for attempt in range(1, 4):
        text = get_clipboard_text()
        if text:
            content = text.replace('\r\n', '\n').strip()
            if content.lower() == "b" or "replace_block:" in content.lower():
                _original_print(f"✅ Код успешно получен из буфера (попытка {attempt})!")
                return content
            else:
                _original_print(f"  Попытка {attempt}: буфер есть ({len(content)} симв.), но нет REPLACE_BLOCK. Жду...")
        else:
            _original_print(f"  Попытка {attempt}: буфер пуст. Жду...")
        if attempt < 3:
            time.sleep(0.5)
    
    _original_print("❌ Буфер не содержит валидный промпт (нет REPLACE_BLOCK).")
    _original_print("   Убедись что скопировал весь блок начиная с CRITICAL RULE.")
    return None

def find_target_filename(prompt_text):
    match = re.search(r'(?:edit file|file|файл)[:\s]+[`\'"]?([a-zA-Z0-9_-]+\.(?:html|js|css|py|txt))[`\'"]?', prompt_text, re.IGNORECASE)
    return match.group(1) if match else None

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

def save_version_and_history(target_file, prompt_content, html_content):
    if not os.path.exists(VERSIONS_DIR): os.makedirs(VERSIONS_DIR)
    file_dir = os.path.join(VERSIONS_DIR, target_file)
    if not os.path.exists(file_dir): os.makedirs(file_dir)
    base, ext = os.path.splitext(target_file)
    
    version_str = ""
    match = re.search(r'Zerkalius:\s*Genesis\s*\(v(\d+\.\d+|\d+)\s*Golden\s*Master\)', html_content, re.IGNORECASE)
    if match:
        raw_ver = match.group(1)
        cleaned_ver = "".join(c for c in raw_ver if c.isdigit())
        if len(cleaned_ver) == 2: version_str = f"0{cleaned_ver}"
        elif len(cleaned_ver) >= 3: version_str = cleaned_ver
        else: version_str = cleaned_ver.zfill(3)

    if not version_str:
        existing_files = [f for f in os.listdir(file_dir) if f.startswith(base + '_v') and f.endswith(ext)]
        version_str = f"{len(existing_files) + 1:03d}"
    
    backup_name = f"{base}_v{version_str}{ext}"
    backup_path = os.path.join(file_dir, backup_name)
    shutil.copy(target_file, backup_path)
    shutil.copy(target_file, target_file + ".bak")
    
    history_file = os.path.join(file_dir, "_history_prompts.txt")
    with open(history_file, 'a', encoding='utf-8-sig') as f:
        f.write(f"\n{'='*60}\n⏱ Версия: v_{version_str} | Дата: {datetime.now().strftime('%d-%m-%Y_%H-%M-%S')}\n{'-'*60}\n{prompt_content.strip()}\n")
    print(f"💾 Версия v{version_str} сохранена.")

def clean_md_blocks(text):
    lines = text.strip('\n').split('\n')
    if lines and lines[0].strip().startswith('```'): lines.pop(0)
    if lines and lines[-1].strip().startswith('```'): lines.pop(-1)
    return '\n'.join(lines).strip('\n')

def get_marker_id(marker_str):
    m = re.search(r'МАРКЕР\s*[:\s]*(.*?)\s*===', marker_str, re.IGNORECASE)
    return m.group(1).strip().lower() if m else None

def apply_patch():
    global accumulate_log, iteration_log
    last_target_file = None
    waiting_msg_shown = False
    
    _original_print("🚀 Запуск УНИВЕРСАЛЬНОГО патчера Zerkalius (Без ограничений на числа)...")
    _original_print("👉 Нажмите любую клавишу для вставки промпта из буфера.\n")
    
    while True:
        prompt_file = prompt_content = None
        kb_cmd = read_keyboard_command()
        if kb_cmd:
            waiting_msg_shown = False
            if kb_cmd == "restore":
                prompt_content = "b"
                prompt_file = "KEYBOARD_CMD"
            else:
                prompt_content = get_manual_prompt_input()
                if not prompt_content:
                    time.sleep(0.2)  # Предотвращает перегрузку процессора при ошибке вставки
                    continue
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
            else: print("❌ Бэкап не найден.")
            if prompt_file not in ["MANUAL_INPUT", "KEYBOARD_CMD"]: move_prompt_file_to_trash(prompt_file)
            accumulate_log = False
            continue

        target_file = find_target_filename(prompt_content) or last_target_file
        if not target_file:
            print("❌ Файл не указан.")
            if prompt_file not in ["MANUAL_INPUT", "KEYBOARD_CMD"]: move_prompt_file_to_trash(prompt_file)
            accumulate_log = False
            continue
            
        last_target_file = target_file
        target_file = resolve_versioned_filename(target_file)

        if not os.path.exists(target_file):
            print(f"❌ Файл '{target_file}' не найден!")
            if prompt_file not in ["MANUAL_INPUT", "KEYBOARD_CMD"]: move_prompt_file_to_trash(prompt_file)
            accumulate_log = False
            continue

        try:
            with open(target_file, 'r', encoding='utf-8', errors='ignore') as f:
                html_content = f.read().replace('\r\n', '\n')
        except Exception as e:
            print(f"❌ Ошибка чтения файла: {e}")
            has_errors = True
            continue

        # Универсальный паттерн поиска блоков (поддерживает и текстовые, и числовые маркеры)
        # Игнорирует пробелы и отступы перед REPLACE_BLOCK и END_BLOCK на любой строке
        block_pattern = re.compile(
            r'^[ \t]*REPLACE_BLOCK:\s*(<!-- === МАРКЕР.*?=== -->)\r?\n(.*?)\r?\n[ \t]*END_BLOCK:\s*(<!-- === МАРКЕР.*?=== -->)', 
            re.DOTALL | re.MULTILINE
        )
        
        block_matches = block_pattern.findall(prompt_content)

        if not block_matches:
            print("❌ ПРЕ-ПРОВЕРКА: В промпте не найдено ни одного валидного REPLACE_BLOCK!")
            if prompt_file not in ["MANUAL_INPUT", "KEYBOARD_CMD"]: move_prompt_file_to_trash(prompt_file)
            accumulate_log = False
            continue

        save_version_and_history(target_file, prompt_content, html_content)
        success_count = 0

        orig_markers_raw = re.findall(r'<!-- === МАРКЕР.*?=== -->', html_content)
        orig_marker_ids = [get_marker_id(m) for m in orig_markers_raw]

        for i, (start_marker_raw, new_code, end_marker_raw) in enumerate(block_matches, 1):
            start_id = get_marker_id(start_marker_raw)
            end_id = get_marker_id(end_marker_raw)

            if start_id not in orig_marker_ids:
                print(f"❌ ОШИБКА: Маркер '{start_marker_raw.strip()}' не найден в файле!")
                has_errors = True
                break
            if end_id not in orig_marker_ids:
                print(f"❌ ОШИБКА: Маркер '{end_marker_raw.strip()}' не найден в файле!")
                has_errors = True
                break

            idx_start = orig_marker_ids.index(start_id)
            idx_end = orig_marker_ids.index(end_id)

            if idx_end != idx_start + 1:
                print(f"🛑 КРИТИЧЕСКОЕ НАРУШЕНИЕ ПРАВИЛА ПОСЛЕДОВАТЕЛЬНОСТИ!")
                print(f"Попытка заменить от маркера '{start_id}' до '{end_id}'. Пропущено маркеров: {idx_end - idx_start - 1} шт.")
                print("ТРАНЗАКЦИЯ СБРОШЕНА.")
                has_errors = True
                break

            cleaned_code = clean_md_blocks(new_code)
            real_start_m = orig_markers_raw[idx_start]
            real_end_m = orig_markers_raw[idx_end]

            parts_start = html_content.split(real_start_m, 1)
            if len(parts_start) != 2:
                print(f"❌ Сбой сплита по стартовому маркеру")
                has_errors = True
                break
                
            parts_end = parts_start[1].split(real_end_m, 1)
            if len(parts_end) != 2:
                print(f"❌ Сбой сплита по конечному маркеру")
                has_errors = True
                break
            
            html_content = parts_start[0] + real_start_m + "\n" + cleaned_code + "\n" + real_end_m + parts_end[1]
            
            print(f"✅ Успешно заменен БЛОК: '{start_id}' -> '{end_id}'.")
            success_count += 1

        if success_count > 0:
            post_warnings = []
            all_markers = re.findall(r'<!-- === МАРКЕР.*?=== -->', html_content)
            marker_counts = Counter(all_markers)
            for m_name, count in marker_counts.items():
                if count > 1: post_warnings.append(f"Дубликат маркера ({count} шт.): {m_name}")
            if "REPLACE_BLOCK:" in html_content: post_warnings.append("Артефакт ИИ: REPLACE_BLOCK в коде!")
            if "END_BLOCK:" in html_content: post_warnings.append("Артефакт ИИ: END_BLOCK в коде!")

            total_expected = len(block_matches)
            if success_count == total_expected and not has_errors:
                with open(target_file, 'w', encoding='utf-8') as f: f.write(html_content)
                print(f"\n🔥 СУПЕР! Применено {success_count} блоков из {total_expected} — ВСЕ ПАТЧИ ВНЕДРЕНЫ! 🏁")
            else:
                print(f"\n⚠️ ВНИМАНИЕ: ОШИБКА ПРИМЕНЕНИЯ! Успешно обработано {success_count} из {total_expected} блоков.")
                print("🛑 АТОМАРНЫЙ РЕЖИМ: ИЗМЕНЕНИЯ ОТМЕНЕНЫ! Целевой файл не изменен.")
                has_errors = True

            if post_warnings:
                print("\n" + "!"*60 + "\n⚠️ АНОМАЛИИ ПОСЛЕ ПАТЧИНГА:")
                for w in post_warnings: print(f"  - {w}")
                print("👉 Если что-то сломалось, нажми 'b' для отката!\n" + "!"*60)
                has_errors = True

        if prompt_file not in ["MANUAL_INPUT", "KEYBOARD_CMD"]: move_prompt_file_to_trash(prompt_file)
        
        accumulate_log = False
        if has_errors:
            log_text = "\n".join(iteration_log)
            if copy_to_clipboard("============================================================\n" + log_text + "\n============================================================"):
                _original_print("📋 Лог ошибок скопирован в буфер! Отправь его ИИ.")
        _original_print("="*60 + "\n")

if __name__ == "__main__":
    apply_patch()