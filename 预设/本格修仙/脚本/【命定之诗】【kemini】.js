const Config = z
  .object({
    user: z.string().default('Human'),
    assistant: z.string().default('Assistant'),
    example_user: z.string().default('H'),
    example_assistant: z.string().default('A'),
    system: z.string().default('SYSTEM'),
    separator: z.string().default(''),
    separator_system: z.string().default(''),
    prefill_user: z.string().default('Continue the conversation.'),
    capture_enabled: z.boolean().default(true),
    capture_rules: z.array(z.any()).default([]),
    stored_data: z.any().default({}),
  })
  .prefault({});

// 获取存储数据
function getStoredData() {
  const data = Config.parse(getVariables({ type: 'script', script_id: getScriptId() }));
  insertVariables(data, { type: 'script', script_id: getScriptId() });
  return _.get(data, 'stored_data', {});
}

// 保存存储数据
function saveStoredData(data) {
  updateVariablesWith(
    variables => {
      _.set(variables, 'stored_data', data);
      return variables;
    },
    { type: 'script', script_id: getScriptId() },
  );
}

function onSettingButtonClick() {
  let root = document.createElement('div');
  root.setAttribute('class', 'merge_editor');

  const tips = document.createElement('h3');
  {
    root.appendChild(tips);
    tips.setAttribute('class', 'flex-container justifyCenter alignItemsBaseline');
    const strong = document.createElement('strong');
    strong.appendChild(document.createTextNode('merge Config'));
    tips.appendChild(strong);

    const small = document.createElement('small');
    small.setAttribute('class', 'flex-container extensions_info');
    small.appendChild(document.createTextNode('该代码为 https://github.com/teralomaniac/clewd 中的片段。'));
    small.setAttribute('style', 'margin-top: 20px');
    root.appendChild(small);
    const hr = document.createElement('hr');
    root.appendChild(hr);
  }

  const content = document.createElement('div');
  {
    root.appendChild(content);
    content.setAttribute('class', 'flex-container flexFlowColumn');
    const width120 = 150;

    // 原有配置项
    [
      'user',
      'assistant',
      'example_user',
      'example_assistant',
      'system',
      'separator',
      'separator_system',
      'prefill_user',
    ].forEach(function (item) {
      const row = document.createElement('div');
      {
        content.appendChild(row);
        row.setAttribute('class', 'flex-container');
        const box = document.createElement('div');
        {
          box.setAttribute('class', 'flex1 flex-container');
          const label = document.createElement('label');
          label.setAttribute('class', 'title_restorable');
          label.setAttribute('style', 'width: ' + width120 + 'px; justify-content: flex-end; padding-right: 10px;');
          const small = document.createElement('small');
          small.appendChild(document.createTextNode(item + ': '));
          label.appendChild(small);
          box.appendChild(label);
          const div = document.createElement('div');
          const input = document.createElement('input');
          input.setAttribute('class', 'config_' + item + ' text_pole textarea_compact');
          div.appendChild(input);
          box.appendChild(div);
          row.appendChild(box);
        }
      }
    });

    // 新增：全局数据捕获开关
    const globalSwitchRow = document.createElement('div');
    globalSwitchRow.setAttribute('class', 'flex-container');
    globalSwitchRow.setAttribute(
      'style',
      'margin-top: 20px; margin-bottom: 10px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;',
    );

    const switchLabel = document.createElement('label');
    switchLabel.setAttribute('class', 'title_restorable');
    switchLabel.setAttribute(
      'style',
      'width: ' + width120 + 'px; justify-content: flex-end; padding-right: 10px; align-items: center; display: flex;',
    );
    const switchLabelText = document.createElement('small');
    switchLabelText.appendChild(document.createTextNode('数据捕获功能: '));
    switchLabel.appendChild(switchLabelText);

    const switchContainer = document.createElement('div');
    switchContainer.setAttribute('style', 'display: flex; align-items: center;');

    const globalSwitch = document.createElement('input');
    globalSwitch.setAttribute('type', 'checkbox');
    globalSwitch.setAttribute('class', 'config_capture_enabled');
    globalSwitch.setAttribute('id', 'global_capture_switch');

    const switchText = document.createElement('span');
    switchText.setAttribute('style', 'margin-left: 10px; font-weight: bold;');
    switchText.setAttribute('id', 'global_switch_text');

    // 更新开关文本的函数
    function updateSwitchText() {
      switchText.textContent = globalSwitch.checked ? '已启用' : '已禁用';
      switchText.style.color = globalSwitch.checked ? '#28a745' : '#dc3545';
    }

    globalSwitch.onchange = updateSwitchText;

    switchContainer.appendChild(globalSwitch);
    switchContainer.appendChild(switchText);

    globalSwitchRow.appendChild(switchLabel);
    globalSwitchRow.appendChild(switchContainer);
    content.appendChild(globalSwitchRow);

    // 数据捕获规则配置区域
    const captureSection = document.createElement('div');
    captureSection.setAttribute('style', 'margin-top: 20px; border-top: 1px solid #ccc; padding-top: 15px;');

    const captureTitle = document.createElement('h4');
    captureTitle.appendChild(document.createTextNode('数据捕获规则配置'));
    captureSection.appendChild(captureTitle);

    // 添加范围说明
    const rangeHelp = document.createElement('p');
    rangeHelp.setAttribute('style', 'font-size: 12px; color: #666; margin: 5px 0;');
    rangeHelp.appendChild(
      document.createTextNode(
        '范围格式: +1 (第1条), -1 (倒数第1条), +1~+3 (第1到第3条), +1,+3~+5,-2 (第1条+第3到第5条+倒数第2条)',
      ),
    );
    captureSection.appendChild(rangeHelp);

    var captureRulesContainer = document.createElement('div');
    captureRulesContainer.setAttribute('class', 'capture_rules_container');
    captureSection.appendChild(captureRulesContainer);

    // 添加规则按钮
    const addRuleBtn = document.createElement('button');
    addRuleBtn.appendChild(document.createTextNode('添加捕获规则'));
    addRuleBtn.setAttribute('type', 'button');
    addRuleBtn.setAttribute('class', 'menu_button');
    addRuleBtn.onclick = function () {
      addCaptureRuleRow(captureRulesContainer);
    };
    captureSection.appendChild(addRuleBtn);

    // 存储数据查看区域
    const storageSection = document.createElement('div');
    storageSection.setAttribute('style', 'margin-top: 20px; border-top: 1px solid #ccc; padding-top: 15px;');

    const storageTitle = document.createElement('h4');
    storageTitle.appendChild(document.createTextNode('已存储数据'));
    storageSection.appendChild(storageTitle);

    var storageContainer = document.createElement('div');
    storageContainer.setAttribute('class', 'storage_container');
    storageSection.appendChild(storageContainer);

    // 清空存储按钮
    const clearStorageBtn = document.createElement('button');
    clearStorageBtn.appendChild(document.createTextNode('清空所有存储数据'));
    clearStorageBtn.setAttribute('type', 'button');
    clearStorageBtn.setAttribute('class', 'menu_button');
    clearStorageBtn.onclick = function () {
      if (confirm('确定要清空所有存储数据吗？')) {
        saveStoredData({});
        updateStorageDisplay(storageContainer);
        toastr.info('存储数据已清空！');
      }
    };
    storageSection.appendChild(clearStorageBtn);

    content.appendChild(captureSection);
    content.appendChild(storageSection);
  }

  const config = getVariables({ type: 'script', script_id: getScriptId() });

  root = $(root);

  // 加载原有配置
  root.find('.config_user').val(config.user);
  root.find('.config_assistant').val(config.assistant);
  root.find('.config_example_user').val(config.example_user);
  root.find('.config_example_assistant').val(config.example_assistant);
  root.find('.config_system').val(config.system);
  root.find('.config_separator').val(config.separator);
  root.find('.config_separator_system').val(config.separator_system);
  root.find('.config_prefill_user').val(config.prefill_user);

  // 加载全局开关状态
  root.find('.config_capture_enabled').prop('checked', config.capture_enabled !== false);
  // 触发change事件来更新文本
  root.find('.config_capture_enabled').trigger('change');

  // 加载捕获规则
  var captureRulesContainer = root.find('.capture_rules_container')[0];
  var storageContainer = root.find('.storage_container')[0];

  if (config.capture_rules && config.capture_rules.length > 0) {
    for (let i = 0; i < config.capture_rules.length; i++) {
      addCaptureRuleRow(captureRulesContainer, config.capture_rules[i]);
    }
  }

  // 显示存储数据
  updateStorageDisplay(storageContainer);

  SillyTavern.callPopup(root, 'confirm', undefined, { okButton: 'Save' }).then(function (ok) {
    if (!ok) {
      return;
    }

    // 保存原有配置
    config.user = root.find('.config_user').val();
    config.assistant = root.find('.config_assistant').val();
    config.example_user = root.find('.config_example_user').val();
    config.example_assistant = root.find('.config_example_assistant').val();
    config.system = root.find('.config_system').val();
    config.separator = root.find('.config_separator').val();
    config.separator_system = root.find('.config_separator_system').val();
    config.prefill_user = root.find('.config_prefill_user').val();

    // 保存全局开关状态
    config.capture_enabled = root.find('.config_capture_enabled').prop('checked');

    // 保存捕获规则
    config.capture_rules = [];
    root.find('.capture_rule_row').each(function () {
      const $this = $(this);
      const enabled = $this.find('.rule_enabled').prop('checked');
      const regex = $this.find('.rule_regex').val();
      const tag = $this.find('.rule_tag').val();
      const updateMode = $this.find('.rule_update_mode').val();
      const range = $this.find('.rule_range').val();

      if (regex && tag) {
        config.capture_rules.push({
          enabled: enabled,
          regex: regex,
          tag: tag,
          updateMode: updateMode,
          range: range,
        });
      }
    });

    SillyTavern.extensionSettings[extensionName] = config;
    SillyTavern.saveSettingsDebounced();
    toastr.info('配置保存成功！');
  });
}

// 添加捕获规则行
function addCaptureRuleRow(container, rule) {
  rule = rule || null;
  const ruleRow = document.createElement('div');
  ruleRow.setAttribute('class', 'capture_rule_row flex-container');
  ruleRow.setAttribute(
    'style',
    'margin-bottom: 10px; align-items: center; padding: 10px; border: 1px solid #ddd; border-radius: 5px;',
  );

  // 新增：规则启用开关
  const enabledDiv = document.createElement('div');
  enabledDiv.setAttribute('style', 'margin-right: 10px; display: flex; flex-direction: column; align-items: center;');
  const enabledLabel = document.createElement('label');
  enabledLabel.appendChild(document.createTextNode('启用'));
  enabledLabel.setAttribute('style', 'font-size: 12px; margin-bottom: 5px;');
  const enabledSwitch = document.createElement('input');
  enabledSwitch.setAttribute('type', 'checkbox');
  enabledSwitch.setAttribute('class', 'rule_enabled');
  enabledSwitch.checked = rule ? rule.enabled !== false : true;

  // 添加开关变化时的视觉反馈
  enabledSwitch.onchange = function () {
    if (enabledSwitch.checked) {
      ruleRow.style.backgroundColor = '';
      ruleRow.style.opacity = '1';
    } else {
      ruleRow.style.backgroundColor = '#f8f9fa';
      ruleRow.style.opacity = '0.7';
    }
  };

  enabledDiv.appendChild(enabledLabel);
  enabledDiv.appendChild(enabledSwitch);

  // 正则表达式输入
  const regexDiv = document.createElement('div');
  regexDiv.setAttribute('style', 'margin-right: 10px;');
  const regexLabel = document.createElement('label');
  regexLabel.appendChild(document.createTextNode('正则: '));
  regexLabel.setAttribute('style', 'font-size: 12px; display: block;');
  const regexInput = document.createElement('input');
  regexInput.setAttribute('class', 'rule_regex');
  regexInput.setAttribute('placeholder', '/pattern/flags');
  regexInput.setAttribute('style', 'width: 250px;');
  regexInput.value = rule ? rule.regex : '';
  regexDiv.appendChild(regexLabel);
  regexDiv.appendChild(regexInput);

  // 标记输入
  const tagDiv = document.createElement('div');
  tagDiv.setAttribute('style', 'margin-right: 10px;');
  const tagLabel = document.createElement('label');
  tagLabel.appendChild(document.createTextNode('标记: '));
  tagLabel.setAttribute('style', 'font-size: 12px; display: block;');
  const tagInput = document.createElement('input');
  tagInput.setAttribute('class', 'rule_tag');
  tagInput.setAttribute('placeholder', '<tag>');
  tagInput.setAttribute('style', 'width: 100px;');
  tagInput.value = rule ? rule.tag : '';
  tagDiv.appendChild(tagLabel);
  tagDiv.appendChild(tagInput);

  // 更新模式选择
  const modeDiv = document.createElement('div');
  modeDiv.setAttribute('style', 'margin-right: 10px;');
  const modeLabel = document.createElement('label');
  modeLabel.appendChild(document.createTextNode('模式: '));
  modeLabel.setAttribute('style', 'font-size: 12px; display: block;');
  const modeSelect = document.createElement('select');
  modeSelect.setAttribute('class', 'rule_update_mode');
  modeSelect.setAttribute('style', 'width: 80px;');
  const option1 = document.createElement('option');
  option1.value = 'accumulate';
  option1.appendChild(document.createTextNode('叠加式'));
  const option2 = document.createElement('option');
  option2.value = 'replace';
  option2.appendChild(document.createTextNode('替换式'));
  modeSelect.appendChild(option1);
  modeSelect.appendChild(option2);
  modeSelect.value = rule ? rule.updateMode : 'accumulate';
  modeDiv.appendChild(modeLabel);
  modeDiv.appendChild(modeSelect);

  // 范围输入
  const rangeDiv = document.createElement('div');
  rangeDiv.setAttribute('style', 'margin-right: 10px;');
  const rangeLabel = document.createElement('label');
  rangeLabel.appendChild(document.createTextNode('范围: '));
  rangeLabel.setAttribute('style', 'font-size: 12px; display: block;');
  const rangeInput = document.createElement('input');
  rangeInput.setAttribute('class', 'rule_range');
  rangeInput.setAttribute('placeholder', '+1,+3~+5,-2');
  rangeInput.setAttribute('style', 'width: 120px;');
  rangeInput.value = rule ? rule.range : '';
  rangeDiv.appendChild(rangeLabel);
  rangeDiv.appendChild(rangeInput);

  // 删除按钮
  const deleteBtn = document.createElement('button');
  deleteBtn.appendChild(document.createTextNode('删除'));
  deleteBtn.setAttribute('type', 'button');
  deleteBtn.setAttribute('class', 'menu_button');
  deleteBtn.setAttribute('style', 'height: 30px; margin-top: 15px;');
  deleteBtn.onclick = function () {
    if (confirm('确定要删除这个捕获规则吗？')) {
      container.removeChild(ruleRow);
    }
  };

  ruleRow.appendChild(enabledDiv);
  ruleRow.appendChild(regexDiv);
  ruleRow.appendChild(tagDiv);
  ruleRow.appendChild(modeDiv);
  ruleRow.appendChild(rangeDiv);
  ruleRow.appendChild(deleteBtn);

  container.appendChild(ruleRow);

  // 初始化视觉状态
  enabledSwitch.onchange();
}

// 更新存储数据显示
function updateStorageDisplay(container) {
  container.innerHTML = '';

  const storedData = getStoredData();
  const keys = Object.keys(storedData);

  for (let i = 0; i < keys.length; i++) {
    const tag = keys[i];
    const storageItem = document.createElement('div');
    storageItem.setAttribute(
      'style',
      'margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;',
    );

    const title = document.createElement('h5');
    title.appendChild(document.createTextNode('标记: ' + tag + ' (' + storedData[tag].length + ' 条数据)'));
    storageItem.appendChild(title);

    const content = document.createElement('textarea');
    content.setAttribute('class', 'stored_data_content');
    content.setAttribute('data-tag', tag);
    content.setAttribute('style', 'width: 100%; height: 150px; resize: vertical; font-family: monospace;');
    content.value = storedData[tag].join('\n---\n');
    storageItem.appendChild(content);

    const buttonRow = document.createElement('div');
    buttonRow.setAttribute('style', 'margin-top: 10px;');

    const saveBtn = document.createElement('button');
    saveBtn.appendChild(document.createTextNode('保存编辑'));
    saveBtn.setAttribute('type', 'button');
    saveBtn.setAttribute('class', 'menu_button');
    saveBtn.setAttribute('style', 'margin-right: 10px;');
    saveBtn.onclick = (function (tagName, textarea) {
      return function () {
        const newContent = textarea.value.trim();
        if (newContent === '') {
          var currentData = getStoredData();
          delete currentData[tagName];
          saveStoredData(currentData);
        } else {
          const newDataArray = newContent
            .split(/\n---\n|\n-{3,}\n/)
            .map(function (item) {
              return item.trim();
            })
            .filter(function (item) {
              return item !== '';
            });
          var currentData = getStoredData();
          currentData[tagName] = newDataArray;
          saveStoredData(currentData);
        }
        updateStorageDisplay(container);
        toastr.info('标记 ' + tagName + ' 的数据已保存！');
      };
    })(tag, content);
    buttonRow.appendChild(saveBtn);

    const clearBtn = document.createElement('button');
    clearBtn.appendChild(document.createTextNode('清空此标记'));
    clearBtn.setAttribute('type', 'button');
    clearBtn.setAttribute('class', 'menu_button');
    clearBtn.onclick = (function (tagName) {
      return function () {
        if (confirm('确定要清空标记 ' + tagName + ' 的数据吗？')) {
          const currentData = getStoredData();
          delete currentData[tagName];
          saveStoredData(currentData);
          updateStorageDisplay(container);
          toastr.info('标记 ' + tagName + ' 的数据已清空！');
        }
      };
    })(tag);
    buttonRow.appendChild(clearBtn);

    storageItem.appendChild(buttonRow);
    container.appendChild(storageItem);
  }

  if (keys.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.appendChild(document.createTextNode('暂无存储数据'));
    emptyMsg.setAttribute('style', 'color: #999; font-style: italic;');
    container.appendChild(emptyMsg);
  }
}

// 数据捕获和处理函数 - 添加开关检查
function captureAndStoreData(content, rules, globalEnabled) {
  // 检查全局开关
  if (!globalEnabled) {
    console.debug('Data capture is globally disabled');
    return;
  }

  const storedData = getStoredData();
  let hasChanges = false;

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];

    // 检查规则是否启用
    if (rule.enabled === false) {
      console.debug('Rule ' + rule.tag + ' is disabled, skipping');
      continue;
    }

    try {
      // 解析正则表达式
      const regexMatch = rule.regex.match(/^\/(.+)\/([gimsu]*)$/);
      if (!regexMatch) {
        console.warn('Invalid regex format: ' + rule.regex);
        continue;
      }

      const pattern = regexMatch[1];
      const flags = regexMatch[2];
      const regex = new RegExp(pattern, flags);

      // 重置正则表达式的lastIndex以确保每次都从头开始匹配
      regex.lastIndex = 0;

      // 捕获匹配的数据
      const matches = [];
      var match;
      if (flags.indexOf('g') !== -1) {
        while ((match = regex.exec(content)) !== null) {
          matches.push(match[0]);
          // 防止无限循环
          if (match.index === regex.lastIndex) {
            regex.lastIndex++;
          }
        }
      } else {
        match = regex.exec(content);
        if (match) {
          matches.push(match[0]);
        }
      }

      // 只有当前规则匹配到数据时才处理
      if (matches.length === 0) {
        console.debug('No matches found for rule: ' + rule.tag);
        continue;
      }

      console.debug('Rule ' + rule.tag + ' found ' + matches.length + ' matches:', matches);

      // 根据范围过滤数据
      let filteredMatches = matches;
      if (rule.range && rule.range.trim()) {
        filteredMatches = filterByRange(matches, rule.range.trim());
      }

      if (filteredMatches.length === 0) {
        console.debug('No matches after range filtering for rule: ' + rule.tag);
        continue;
      }

      // 根据更新模式处理数据
      if (rule.updateMode === 'replace') {
        // 替换式：直接替换
        storedData[rule.tag] = filteredMatches.slice();
        hasChanges = true;
        console.debug('Replaced data for tag ' + rule.tag + ':', filteredMatches);
      } else {
        // 叠加式：去重后添加
        if (!storedData[rule.tag]) {
          storedData[rule.tag] = [];
        }

        const beforeCount = storedData[rule.tag].length;
        for (let j = 0; j < filteredMatches.length; j++) {
          const newData = filteredMatches[j];
          if (storedData[rule.tag].indexOf(newData) === -1) {
            storedData[rule.tag].push(newData);
            hasChanges = true;
          }
        }
        const afterCount = storedData[rule.tag].length;
        console.debug('Accumulated data for tag ' + rule.tag + ': ' + (afterCount - beforeCount) + ' new items added');
      }
    } catch (error) {
      console.error('Error processing capture rule for tag ' + rule.tag + ':', error);
    }
  }

  // 只有在有变化时才保存
  if (hasChanges) {
    saveStoredData(storedData);
    console.debug('Stored data updated and saved');
  }
}

// 重新设计的范围过滤函数，支持分段选择
function filterByRange(array, rangeStr) {
  try {
    const result = [];
    const segments = rangeStr.split(',');

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i].trim();
      if (!segment) continue;

      if (segment.indexOf('~') !== -1) {
        // 范围格式：+1~+3, -5~-1 等
        const rangeParts = segment.split('~');
        const start = rangeParts[0].trim();
        const end = rangeParts[1].trim();
        let startIndex = parseRangeIndex(start, array.length);
        let endIndex = parseRangeIndex(end, array.length);

        if (startIndex > endIndex) {
          const temp = startIndex;
          startIndex = endIndex;
          endIndex = temp;
        }

        for (let j = startIndex; j <= endIndex && j < array.length; j++) {
          if (j >= 0 && result.indexOf(array[j]) === -1) {
            result.push(array[j]);
          }
        }
      } else {
        // 单个索引：+1, -1 等
        const index = parseRangeIndex(segment, array.length);
        if (index >= 0 && index < array.length && result.indexOf(array[index]) === -1) {
          result.push(array[index]);
        }
      }
    }

    return result;
  } catch (error) {
    console.warn('Invalid range format: ' + rangeStr, error);
    return array;
  }
}

// 解析范围索引
function parseRangeIndex(indexStr, arrayLength) {
  indexStr = indexStr.trim();
  if (indexStr.charAt(0) === '+') {
    // 正数索引：+1 表示第1个（索引0）
    return parseInt(indexStr.substring(1)) - 1;
  } else if (indexStr.charAt(0) === '-') {
    // 负数索引：-1 表示倒数第1个
    return arrayLength + parseInt(indexStr);
  } else {
    // 纯数字，按正数处理
    return parseInt(indexStr) - 1;
  }
}

// 替换标记函数
function replaceTagsWithStoredData(content) {
  const storedData = getStoredData();
  const keys = Object.keys(storedData);

  for (let i = 0; i < keys.length; i++) {
    const tag = keys[i];
    if (content.indexOf(tag) !== -1 && storedData[tag].length > 0) {
      const replacement = storedData[tag].join('\n');
      const escapedTag = escapeRegExp(tag);
      const replaceRegex = new RegExp(escapedTag, 'g');
      content = content.replace(replaceRegex, replacement);
      console.debug('Replaced tag ' + tag + ' with ' + storedData[tag].length + ' stored items');
    }
  }
  return content;
}

// 转义正则表达式特殊字符
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- Helper function to process a block of messages meant for merging ---
function processAndAddMergeBlock(config, blockToMerge, targetArray) {
  if (!blockToMerge || blockToMerge.length === 0) {
    return; // Nothing to process
  }

  // 在处理前先捕获数据 - 添加开关检查
  if (config.capture_enabled !== false && config.capture_rules && config.capture_rules.length > 0) {
    let combinedContent = '';
    for (let i = 0; i < blockToMerge.length; i++) {
      if (blockToMerge[i].content) {
        combinedContent += (combinedContent ? '\n\n' : '') + blockToMerge[i].content;
      }
    }
    console.debug('merge config >>> Content before capture:', combinedContent.substring(0, 200) + '...');
    captureAndStoreData(combinedContent, config.capture_rules, config.capture_enabled);
  } else {
    console.debug('merge config >>> Data capture is disabled or no rules configured');
  }

  // Process the collected block using the original 'process' function
  const mergedAssistantMessage = process(config, blockToMerge);

  console.debug('merge config >>>>>>>>>>>>> Processing Block for Merging <<<<<<<<<<<<<<<<<');

  // 在合并后立即进行标记替换
  if (mergedAssistantMessage && mergedAssistantMessage.content) {
    const beforeReplacement = mergedAssistantMessage.content;
    mergedAssistantMessage.content = replaceTagsWithStoredData(mergedAssistantMessage.content);

    if (beforeReplacement !== mergedAssistantMessage.content) {
      console.debug('merge config >>> Tags were replaced in merged content');
    }
  }

  // 现在输出的是标记替换后的最终内容
  console.debug('merge config >>> Merged Content (After Tag Replacement):', mergedAssistantMessage.content);

  let systemMessage = null;
  // Handle potential system prompt extraction from the *merged* content
  if (config.separator_system) {
    const systemIndex = mergedAssistantMessage.content.indexOf(config.separator_system);
    if (systemIndex > 0) {
      const systemContent = mergedAssistantMessage.content.substr(0, systemIndex + config.separator_system.length);
      // Modify the merged assistant message content to remove the system part
      mergedAssistantMessage.content = mergedAssistantMessage.content.substr(
        systemIndex + config.separator_system.length,
      );
      // Create a separate system message
      systemMessage = { role: 'system', content: systemContent };
      console.debug('merge config >>> Extracted System Message:', systemContent);
    }
  }

  // Add extracted system message FIRST for this block (if it exists)
  if (systemMessage) {
    targetArray.push(systemMessage);
  }

  // Add the prefill user message and assistant message pair (if assistant has content)
  if (mergedAssistantMessage && mergedAssistantMessage.content.trim()) {
    // 将合并后的消息放入 'user' 角色
    mergedAssistantMessage.role = 'user';
    targetArray.push(mergedAssistantMessage);
  }
}

// --- Helper function to handle system message separation for preserved messages ---
function processPreservedSystemMessage(config, message, targetArray) {
  let systemMessage = null;
  let remainingContent = message.content;

  // Handle potential system prompt extraction from preserved content
  if (config.separator_system && message.role === 'system') {
    const systemIndex = remainingContent.indexOf(config.separator_system);
    if (systemIndex > 0) {
      const systemContent = remainingContent.substr(0, systemIndex + config.separator_system.length);
      remainingContent = remainingContent.substr(systemIndex + config.separator_system.length).trim();

      // Create a separate system message for the extracted part
      systemMessage = { role: 'system', content: systemContent };
      console.debug('merge config >>> Extracted System Message from preserved:', systemContent);
    }
  }

  // Add extracted system message first (if it exists)
  if (systemMessage) {
    targetArray.push(systemMessage);
  }

  // Add the remaining content as the original message (if any content remains)
  if (remainingContent) {
    const preservedMessage = {
      role: message.role,
      content: remainingContent,
    };
    if (message.name) preservedMessage.name = message.name;
    targetArray.push(preservedMessage);
    console.debug(
      'merge config >>> Preserving message (tag removed, system processed):',
      preservedMessage.role,
      preservedMessage.content.substring(0, 50) + '...',
    );
  } else if (!systemMessage) {
    // If no system message was extracted and no content remains, still add the original
    targetArray.push(message);
    console.debug(
      'merge config >>> Preserving message (tag removed, no system processing):',
      message.role,
      message.content.substring(0, 50) + '...',
    );
  }
}
// --- End of helper function ---

eventOn(tavern_events.CHAT_COMPLETION_SETTINGS_READY, function (completion) {
  console.log('script.event_types.CHAT_COMPLETION_SETTINGS_READY triggered');
  if (SillyTavern.mainApi !== 'openai') {
    console.log('Not an OpenAI API, skipping merge processing.');
    return;
  }
  const config = getVariables({ type: 'script', script_id: getScriptId() });
  const NO_TRANS_TAG = '<|no-trans|>'; // Define the tag

  const originalMessages = completion.messages;
  const finalMessages = [];
  let currentMergeBlock = []; // Accumulates messages to be merged

  console.debug('Original messages:', JSON.stringify(originalMessages, null, 2));
  console.debug('Data capture global switch:', config.capture_enabled !== false ? 'Enabled' : 'Disabled');

  // Iterate through original messages to build the final list in order
  for (let i = 0; i < originalMessages.length; i++) {
    const message = originalMessages[i];
    if (message.content && message.content.indexOf(NO_TRANS_TAG) !== -1) {
      // 1. Process any pending messages in the current merge block
      processAndAddMergeBlock(config, currentMergeBlock, finalMessages);
      currentMergeBlock = []; // Reset the block

      // 2. Process the current message (remove tag and handle system separation)
      const messageWithoutTag = {
        role: message.role,
        content: message.content.replace(NO_TRANS_TAG, '').trim(),
      };
      if (message.name) messageWithoutTag.name = message.name;

      // Only process if content remains after tag removal
      if (messageWithoutTag.content) {
        processPreservedSystemMessage(config, messageWithoutTag, finalMessages);
      } else {
        console.debug(
          'merge config >>> Skipping preserved message as content is empty after tag removal:',
          message.role,
        );
      }
    } else {
      // Add this message to the current block waiting to be merged
      currentMergeBlock.push(message);
      console.debug('merge config >>> Added message to current merge block:', message.role);
    }
  }

  // After the loop, process any remaining messages in the last merge block
  processAndAddMergeBlock(config, currentMergeBlock, finalMessages);

  // 在所有处理完成后，对保留的消息也进行标记替换
  for (let i = 0; i < finalMessages.length; i++) {
    if (finalMessages[i].content) {
      const beforeReplacement = finalMessages[i].content;
      finalMessages[i].content = replaceTagsWithStoredData(finalMessages[i].content);
      if (beforeReplacement !== finalMessages[i].content) {
        console.debug('merge config >>> Tags were replaced in final message ' + i);
      }
    }
  }

  // Replace the original completion messages
  completion.messages = finalMessages;

  console.debug(
    'merge config >>>>>>>>>>>>> Final Message Structure <<<<<<<<<<<<<<<<<\n',
    JSON.stringify(completion.messages, null, 2),
  );
});

SillyTavern.SlashCommandParser.addCommandObject(
  SillyTavern.SlashCommand.fromProps({
    name: 'kemini',
    callback: onSettingButtonClick,
  }),
);

// ==============================================
// The 'process' function - 恢复原始的正则处理逻辑
// ==============================================

function process(prefixs, messages) {
  prefixs = prefixs || defaultConfig;

  const HyperProcess = function (system, messages, claudeMode) {
    const hyperMerge = function (content, mergeDisable) {
      const splitContent = content.split(
        new RegExp('\\n\\n(' + prefixs['assistant'] + '|' + prefixs['user'] + '|' + prefixs['system'] + '):', 'g'),
      );
      content =
        splitContent[0] +
        splitContent.slice(1).reduce(function (acc, current, index, array) {
          const merge =
            index > 1 &&
            current === array[index - 2] &&
            ((current === prefixs['user'] && !mergeDisable.user) ||
              (current === prefixs['assistant'] && !mergeDisable.assistant) ||
              (current === prefixs['system'] && !mergeDisable.system));
          return acc + (index % 2 !== 0 ? current.trim() : '\n\n' + (merge ? '' : current + ': '));
        }, '');
      return content;
    };

    const hyperRegex = function (content, order) {
      let regexLog = '';
      const regexPattern =
        '<regex(?: +order *= *' +
        order +
        ')' +
        (order === 2 ? '?' : '') +
        '> *"(/?)(.*)\\1(.*?)" *: *"(.*?)" *</regex>';
      const matches = content.match(new RegExp(regexPattern, 'gm'));

      if (matches) {
        for (let i = 0; i < matches.length; i++) {
          const match = matches[i];
          try {
            const reg = /<regex(?: +order *= *\d)?> *"(\/?)(.*)\1(.*?)" *: *"(.*?)" *<\/regex>/.exec(match);
            regexLog += match + '\n';
            const replacePattern = new RegExp(reg[2], reg[3]);
            const replacement = JSON.parse('"' + reg[4].replace(/\\?"/g, '\\"') + '"');
            content = content.replace(replacePattern, replacement);
          } catch (e) {
            console.warn('Regex processing error:', e);
          }
        }
      }
      return [content, regexLog];
    };

    const HyperPmtProcess = function (content) {
      const regex1 = hyperRegex(content, 1);
      content = regex1[0];
      regexLogs += regex1[1];

      const mergeDisable = {
        all: content.indexOf('<|Merge Disable|>') !== -1,
        system: content.indexOf('<|Merge System Disable|>') !== -1,
        user: content.indexOf('<|Merge Human Disable|>') !== -1,
        assistant: content.indexOf('<|Merge Assistant Disable|>') !== -1,
      };

      const systemPattern1 = new RegExp(
        '(\\n\\n|^\\s*)(?<!\\n\\n(' +
          prefixs['user'] +
          '|' +
          prefixs['assistant'] +
          '):.*?)' +
          prefixs['system'] +
          ':\\s*',
        'gs',
      );
      const systemPattern2 = new RegExp('(\\n\\n|^\\s*)' + prefixs['system'] + ': *', 'g');

      content = content
        .replace(systemPattern1, '$1')
        .replace(
          systemPattern2,
          mergeDisable.all || mergeDisable.user || mergeDisable.system ? '$1' : '\n\n' + prefixs['user'] + ': ',
        );
      content = hyperMerge(content, mergeDisable);

      const splitPattern = new RegExp('\\n\\n(?=' + prefixs['assistant'] + ':|' + prefixs['user'] + ':)', 'g');
      const splitContent = content.split(splitPattern);

      let match;
      const atPattern = /<@(\d+)>(.*?)<\/@\1>/gs;
      while ((match = atPattern.exec(content)) !== null) {
        const index = splitContent.length - parseInt(match[1]) - 1;
        if (index >= 0) {
          splitContent[index] += '\n\n' + match[2];
        }
        content = content.replace(match[0], '');
      }

      content = splitContent.join('\n\n').replace(/<@(\d+)>.*?<\/@\1>/gs, '');

      const regex2 = hyperRegex(content, 2);
      content = regex2[0];
      regexLogs += regex2[1];
      content = hyperMerge(content, mergeDisable);

      const regex3 = hyperRegex(content, 3);
      content = regex3[0];
      regexLogs += regex3[1];

      content = content
        .replace(/<regex( +order *= *\d)?>.*?<\/regex>/gm, '')
        .replace(/\r\n|\r/gm, '\n')
        .replace(/\s*<\|curtail\|>\s*/g, '\n')
        .replace(/\s*<\|join\|>\s*/g, '')
        .replace(/\s*<\|space\|>\s*/g, ' ')
        .replace(/<\|(\\.*?)\|>/g, function (match, p1) {
          try {
            return JSON.parse('"' + p1 + '"');
          } catch {
            return match;
          }
        });

      return content
        .replace(/\s*<\|.*?\|>\s*/g, '\n\n')
        .trim()
        .replace(/^.+:/, '\n\n$&')
        .replace(/(?<=\n)\n(?=\n)/g, '');
    };

    let prompt = system || '';
    let regexLogs = '';

    if (!messages || messages.length === 0) {
      return { prompt: '', log: '' };
    }

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      if (message && message.content) {
        const role = message.role || 'user';
        const name = message.name;
        const prefixLookup = prefixs[name] || prefixs[role] || role;
        const prefix = '\n\n' + prefixLookup + (name ? ': ' + name : '') + ': ';
        prompt += prefix + message.content.trim();
      } else {
        console.warn('Skipping invalid message object:', message);
      }
    }

    prompt = HyperPmtProcess(prompt);
    if (!claudeMode && prompt) {
      prompt += '\n\n' + prefixs['assistant'] + ':';
    }
    return { prompt: prompt, log: '\n####### Regex:\n' + regexLogs };
  };

  let separator = '';
  if (prefixs.separator) {
    try {
      separator = JSON.parse('"' + prefixs.separator + '"');
    } catch (e) {
      console.error(e);
    }
  }

  const youPmtProcess = function (prompt, separator) {
    if (typeof prompt !== 'string' || !prompt) return '';
    const splitPattern = new RegExp('\\n\\n(?=' + prefixs['assistant'] + ':|' + prefixs['user'] + ':)', 'g');
    return prompt.split(splitPattern).join('\n' + separator + '\n');
  };

  const result = HyperProcess('', messages, true);
  const prompt = result.prompt;

  const youPrompt = prompt.split(/\s*\[-youFileTag-\]\s*/);
  const filePrompt = youPrompt.length > 0 ? youPrompt.pop().trim() : '';

  return {
    role: 'assistant',
    content: youPmtProcess(filePrompt, separator),
  };
}
