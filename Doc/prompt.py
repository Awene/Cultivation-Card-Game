#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
世界书文件合并脚本
将世界书文件夹中以[开头的文件和其他特殊指定的文件读取并拼接，生成prompt.txt
"""

import os
import re
from pathlib import Path
from typing import List, Tuple


def get_worldbook_path() -> Path:
    """获取世界书文件夹路径"""
    current_dir = Path(__file__).parent
    worldbook_path = current_dir.parent / "世界书"
    return worldbook_path


def get_files_to_process(worldbook_path: Path) -> List[Tuple[str, Path]]:
    """
    获取需要处理的文件列表
    返回 (排序键, 文件路径) 的列表
    """
    files_to_process = []
    
    # 特殊指定的文件（按优先级排序）
    special_files = [
        # "variables.txt",
    ]
    
    # 扫描文件夹
    if not worldbook_path.exists():
        print(f"错误: 世界书文件夹不存在: {worldbook_path}")
        return []
    
    # 首先添加特殊文件
    for special_file in special_files:
        file_path = worldbook_path / special_file
        if file_path.exists() and file_path.is_file():
            files_to_process.append((f"00_{special_file}", file_path))
    
    # 然后添加以[开头的文件
    for file_path in sorted(worldbook_path.iterdir()):
        if file_path.is_file() and file_path.name.startswith("["):
            # 使用文件名作为排序键，保持字母顺序
            files_to_process.append((file_path.name, file_path))
    
    return files_to_process


def read_file_content(file_path: Path) -> str:
    """读取文件内容，处理编码问题"""
    try:
        # 尝试使用 UTF-8 编码读取
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    except UnicodeDecodeError:
        # 如果 UTF-8 失败，尝试 GBK
        try:
            with open(file_path, "r", encoding="gbk") as f:
                return f.read()
        except UnicodeDecodeError:
            # 最后尝试 latin-1
            with open(file_path, "r", encoding="latin-1") as f:
                return f.read()


def generate_prompt(worldbook_path: Path, output_path: Path) -> None:
    """生成合并后的prompt.txt文件"""
    
    files_to_process = get_files_to_process(worldbook_path)
    
    if not files_to_process:
        print("警告: 没有找到需要处理的文件")
        return
    
    print(f"找到 {len(files_to_process)} 个文件需要处理")
    
    # 合并所有文件内容
    combined_content = []
    
    for sort_key, file_path in files_to_process:
        print(f"处理: {file_path.name}")
        
        try:
            content = read_file_content(file_path)
            
            # 添加文件分隔符和文件名
            combined_content.append(f"\n{'='*80}")
            combined_content.append(f"文件: {file_path.name}")
            combined_content.append(f"{'='*80}\n")
            
            # 添加文件内容
            combined_content.append(content)
            
        except Exception as e:
            print(f"错误: 读取文件 {file_path.name} 失败: {e}")
            continue
    
    # 写入输出文件
    try:
        output_content = "\n".join(combined_content)
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(output_content)
        
        print(f"\n✓ 成功生成: {output_path}")
        print(f"  文件大小: {len(output_content) / 1024:.2f} KB")
        
    except Exception as e:
        print(f"错误: 写入输出文件失败: {e}")


def main():
    """主函数"""
    worldbook_path = get_worldbook_path()
    # 输出路径在 Doc 文件夹中
    output_path = Path(__file__).parent / "prompt.txt"
    
    print(f"世界书路径: {worldbook_path}")
    print(f"输出路径: {output_path}")
    print()
    
    generate_prompt(worldbook_path, output_path)


if __name__ == "__main__":
    main()
