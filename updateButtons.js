/**
 * Функция для обновления состояния кнопок режимов на панели управления.
 * 
 * @param {string} modeName - Имя режима для активации:
 *   - "step1", "step2", "xor1", "xor2", "horiz_xor", "horiz_xor_left", "xor_proj", "scan" - обычные режимы
 *   - "interleave_seq", "xor_seq" - сквозные режимы
 *   - "direction" - специальный режим для обработки кнопок направлений
 * 
 * Функция устанавливает класс 'mode-act' только к одной кнопке и сбрасывает флаги режимов,
 * сохраняя логику взаимодействия с другими элементами интерфейса, подобно оригинальной setMode().
 */
function updateButtons(modeName) {
  // Массивы идентификаторов кнопок, которые могут быть активны
  const STEP_MODE_BTN_IDS = ["bStep", "bStep2", "bStepXor", "bStep2Xor", "bStepHorizXor", "bStepHorizXorLeft", "bStepXorProj", "bStepScan"];
  const SEQ_MODE_BTN_IDS = ["bInterleaveSeqSearch", "bXorSeqSearch"];
  const DIR_MODE_BTN = { shiftL: "bShiftL", shiftR: "bShiftR", shiftLInv: "bShiftLInv", shiftRInv: "bShiftRInv", spiralUp: "bSpiralUp", spiralDown: "bSpiralDown" };

  // Сбрасываем флаги режимов (как в оригинальном setMode)
  st.xorSelectedMode = false;
  st.interleaveMode = false;
  st.interleaveSeqMode = false;
  st.xorSeqMode = false;

  // Убираем .mode-act у всех кнопок сквозных режимов
  SEQ_MODE_BTN_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("mode-act");
  });
  
  // Если была нажата кнопка направления, сбрасываем её
  if (st.lastDirMode) setLastDirMode(null);
  
  // Очищаем карту инвертированных флагов
  invFlagsMap.clear();
  
  // Обновляем счетчик вариантов
  updateVariantCounter();

  const modes = {
    "step1":     "bStep",
    "step2":     "bStep2",
    "xor1":      "bStepXor",
    "xor2":      "bStep2Xor",
    "horiz_xor": "bStepHorizXor",
    "horiz_xor_left": "bStepHorizXorLeft",
    "xor_proj":  "bStepXorProj",
    "scan":      "bStepScan"
  };

  const undoBtn = document.getElementById("bUndo");

  // Убираем .mode-act у всех кнопок стандартных режимов
  STEP_MODE_BTN_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("mode-act");
  });
  
  // Проверяем, является ли мод режимом направления
  if (modeName === "direction") {
    // Для специальных кнопок направлений - удаляем классы со всех кнопок,
    // кроме той, что отмечена в lastDirMode  
    Object.entries(DIR_MODE_BTN).forEach(([k, id]) => {
      const el = document.getElementById(id);
      if (el) {
        if (k === st.lastDirMode) {
          el.classList.add("mode-act");
          if (undoBtn) {
            undoBtn.style.top = (el.offsetTop + el.offsetHeight + 2) + "px";
            undoBtn.style.left = el.offsetLeft + "px";
          }
        } else {
          el.classList.remove("mode-act");
        }
      }
    });
  } else {
    // Добавляем класс .mode-act к нужной кнопке
    const modeKey = modes[modeName];
    if (modeKey) {
      const el = document.getElementById(modeKey);
      if (el) {
        el.classList.add("mode-act");
        if (undoBtn) {
          undoBtn.style.top = (el.offsetTop + el.offsetHeight + 2) + "px";
          undoBtn.style.left = el.offsetLeft + "px";
        }
      } else {
        // Если обычный режим, а кнопки не нашлось - значит это сквозной режим
        if (modeName === "interleave_seq") {
          const seqEl = document.getElementById("bInterleaveSeqSearch");
          if (seqEl) {
            seqEl.classList.add("mode-act");
            if (undoBtn) {
              undoBtn.style.top = (seqEl.offsetTop + seqEl.offsetHeight + 2) + "px";
              undoBtn.style.left = seqEl.offsetLeft + "px";
            }
          }
        } else if (modeName === "xor_seq") {
          const seqEl = document.getElementById("bXorSeqSearch");
          if (seqEl) {
            seqEl.classList.add("mode-act");
            if (undoBtn) {
              undoBtn.style.top = (seqEl.offsetTop + seqEl.offsetHeight + 2) + "px";
              undoBtn.style.left = seqEl.offsetLeft + "px";
            }
          }
        }
      }
    } else {
      // Если обычный режим, а кнопки не нашлось - значит это сквозной режим
      if (modeName === "interleave_seq") {
        const seqEl = document.getElementById("bInterleaveSeqSearch");
        if (seqEl) {
          seqEl.classList.add("mode-act");
          if (undoBtn) {
            undoBtn.style.top = (seqEl.offsetTop + seqEl.offsetHeight + 2) + "px";
            undoBtn.style.left = seqEl.offsetLeft + "px";
          }
        }
      } else if (modeName === "xor_seq") {
        const seqEl = document.getElementById("bXorSeqSearch");
        if (seqEl) {
          seqEl.classList.add("mode-act");
          if (undoBtn) {
            undoBtn.style.top = (seqEl.offsetTop + seqEl.offsetHeight + 2) + "px";
            undoBtn.style.left = seqEl.offsetLeft + "px";
          }
        }
      }
    }
  }
}