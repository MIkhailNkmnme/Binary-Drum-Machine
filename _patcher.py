import os
import re
import shutil
from datetime import datetime
import sys

PROMPT_FILE = "ai_studio_code" # твой файл с промптом
VERSIONS_DIR = "_Versions"          # каталог сохранения версий

def find_target_filename(prompt_text):
    # Жесткий поиск: ищем слова "edit file" или "файл", за которыми идет имя с расширением .html, .py, .js и т.д.
    match = re.search(r'(?:edit file|file|файл)[:\s]+[`\'"]?([a-zA-Z0-9_-]+\.(?:html|js|css|py|txt))[`\'"]?', prompt_text, re.IGNORECASE)
    if match:
        return match.group(1)
    return None

def resolve_versioned_filename(target_file):
    """
    Если оригинальный файл (например, Zerkalius-interleaving.html) отсутствует,
    ищет в папке последнюю версию вида Zerkalius-interleaving_v002.html и т.д.
    """
    if os.path.exists(target_file):
        return target_file
    
    base, ext = os.path.splitext(target_file)
    pattern_re = re.compile(rf"^{re.escape(base)}_v(\d+){re.escape(ext)}$", re.IGNORECASE)
    
    candidates = []
    for f in os.listdir('.'):
        match = pattern_re.match(f)
        if match:
            version_num = int(match.group(1))
            candidates.append((version_num, f))
            
    if candidates:
        candidates.sort()
        best_match = candidates[-1][1]
        print(f"ℹ️ Исходный файл '{target_file}' не найден, но обнаружена актуальная версия: '{best_match}'")
        return best_match
        
    return target_file

def get_prompt_content():
    content = ""
    # Пытаемся прочитать из файла
    if os.path.exists(PROMPT_FILE):
        try:
            with open(PROMPT_FILE, 'r', encoding='utf-8') as f:
                content = f.read().replace('\r\n', '\n').strip()
        except UnicodeDecodeError:
            try:
                with open(PROMPT_FILE, 'r', encoding='windows-1251') as f:
                    content = f.read().replace('\r\n', '\n').strip()
            except:
                pass
    
    # Если файла нет или он пуст - просим ввести в консоль
    if not content:
        print(f"📄 Рабочий файл '{PROMPT_FILE}' пуст.")
        print("👇 Вставьте текст промпта прямо сюда (в окно консоли).")
        print("⚠️ Для завершения просто нажмите Enter ДВА РАЗА подряд.")
        print("-" * 60)
        
        lines = []
        empty_count = 0
        while True:
            try:
                # Используем sys.stdin.readline для безопасного захвата байтов
                line = sys.stdin.readline()
                if not line: break
                line = line.strip('\r\n')
                
                if line == "":
                    empty_count += 1
                    if empty_count >= 2:
                        if lines and lines[-1].strip() == "":
                            lines.pop()
                        break
                else:
                    empty_count = 0
                lines.append(line)
            except EOFError:
                break
        
        content = "\n".join(lines)
        print("-" * 60)
        
    return content

def save_version_and_history(target_file, prompt_content):
    # Создаем главную папку версий
    if not os.path.exists(VERSIONS_DIR):
        os.makedirs(VERSIONS_DIR)
        
    # Создаем подпапку для конкретного файла
    file_dir = os.path.join(VERSIONS_DIR, target_file)
    if not os.path.exists(file_dir):
        os.makedirs(file_dir)
        
    # Считаем количество уже существующих версий для нумерации
    base, ext = os.path.splitext(target_file)
    existing_files = [f for f in os.listdir(file_dir) if f.startswith(base + '_v') and f.endswith(ext)]
    version_num = len(existing_files) + 1
    
    timestamp = datetime.now().strftime("%d-%m-%Y_%H-%M-%S")
    
    # 1. Сохраняем копию HTML (Бэкап) с оригинальным именем и номером версии
    backup_name = f"{base}_v{version_num:03d}{ext}"
    backup_path = os.path.join(file_dir, backup_name)
    shutil.copy(target_file, backup_path)
    print(f"💾 Версия файла сохранена: {backup_path}")
    
    # Создаем дубликат в корневой папке с расширением .bak для быстрого восстановления
    quick_backup_path = target_file + ".bak"
    shutil.copy(target_file, quick_backup_path)
    print(f"🔄 Быстрый бэкап создан: {quick_backup_path}")
    
    # 2. Сохраняем промпт в историю внутри этой же подпапки
    history_file = os.path.join(file_dir, "_history_prompts.txt")
    
    # Записываем с utf-8-sig (BOM) чтобы Windows блокнот правильно читал русский язык!
    with open(history_file, 'a', encoding='utf-8-sig') as f:
        f.write(f"\n{'='*60}\n")
        f.write(f"⏱ Версия: v_{version_num:03d} | Дата: {timestamp} | Файл: {target_file}\n")
        f.write(f"{'-'*60}\n")
        f.write(prompt_content.strip() + "\n")
    print(f"📜 Промпт добавлен в лог: {history_file}")

def apply_patch():
    print("Запуск авто-патчера Zerkalius...\n")
    
    prompt_content = get_prompt_content()
    
    if not prompt_content or not prompt_content.strip():
        print("🔄 Обнаружен пустой ввод. Попытка восстановления бэкапа...")
        bak_files = [f for f in os.listdir('.') if f.endswith('.bak')]
        if bak_files:
            bak_files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
            latest_bak = bak_files[0]
            original_file = latest_bak[:-4]
            try:
                shutil.copy(latest_bak, original_file)
                print(f"\n✅ Успешно восстановлен исходный файл: '{original_file}' из бэкапа '{latest_bak}'!")
            except Exception as e:
                print(f"❌ Ошибка при восстановлении бэкапа: {e}")
        else:
            print("❌ Ошибка: Ввод пуст, и файлы бэкапа (*.bak) в этой папке не найдены.")
        return

    target_file = find_target_filename(prompt_content)
    
    if not target_file:
        print("❌ Ошибка: Не удалось найти имя файла для патчинга.")
        return

    # Пытаемся автоматически найти самую свежую версию файла, если точного совпадения нет
    target_file = resolve_versioned_filename(target_file)

    print(f"🎯 Обнаружен целевой файл: {target_file}")

    if not os.path.exists(target_file):
        print(f"❌ Ошибка: Файл '{target_file}' не найден в этой папке!")
        return

    try:
        with open(target_file, 'r', encoding='utf-8') as f:
            html_content = f.read().replace('\r\n', '\n')
    except:
        with open(target_file, 'r', encoding='windows-1251') as f:
            html_content = f.read().replace('\r\n', '\n')

    # Вызываем функцию сохранения версий и истории
    save_version_and_history(target_file, prompt_content)

    # Улучшенное регулярное выражение для поддержки как нумерованных, так и обычных FIND:
    pattern = re.compile(r'FIND:\n(.*?)\nREPLACE WITH:\n(.*?)(?=\n+(?:[^\n]*?)FIND:|\Z)', re.DOTALL)
    matches = pattern.findall(prompt_content)

    if not matches:
        print("⚠️ Не найдено ни одного блока FIND/REPLACE.")
        return

    success_count = 0
    for i, (find_text, replace_text) in enumerate(matches, 1):
        find_text = find_text.strip('\n')
        replace_text = replace_text.strip('\n')

        if find_text in html_content:
            html_content = html_content.replace(find_text, replace_text)
            print(f"✅ Шаг {i}: Блок успешно заменен.")
            success_count += 1
        else:
            print(f"❌ Шаг {i}: Блок НЕ НАЙДЕН в файле {target_file}!")
            print(f"   --- Искали (первые 80 символов): ---")
            print(f"   {find_text[:80]}...")
            print(f"   ------------------------------------")

    with open(target_file, 'w', encoding='utf-8') as f:
        f.write(html_content)

    print(f"\n🚀 Готово! Успешно применено {success_count} из {len(matches)} патчей.")

if __name__ == "__main__":
    try:
        apply_patch()
    except Exception as e:
        print(f"\n❌ Критическая ошибка выполнения: {e}")
    finally:
        print("\n" + "="*60)
        try:
            import msvcrt
            print("⌨️ Нажмите ESC или DELETE для закрытия окна...")
            while True:
                if msvcrt.kbhit():
                    char = msvcrt.getch()
                    if char == b'\x1b':  # Клавиша ESC
                        break
                    elif char in (b'\x00', b'\xe0'):  # Префикс для сервисных клавиш на Windows
                        char2 = msvcrt.getch()
                        if char2 == b'S':  # Клавиша DELETE
                            break
        except ImportError:
            input("Нажмите ENTER для закрытия окна...")
