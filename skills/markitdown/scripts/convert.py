"""MarkItDown 文件转换脚本
用法: python convert.py <输入文件路径> [-o <输出文件路径>]

将文件转换为 Markdown，默认输出到系统临时目录。
"""

import sys
import os
import tempfile


def main():
    args = sys.argv[1:]
    if not args:
        print("用法: python convert.py <输入文件路径> [-o <输出文件路径>]", file=sys.stderr)
        sys.exit(1)

    input_path = os.path.abspath(args[0])
    output_path = None

    if "-o" in args:
        idx = args.index("-o")
        if idx + 1 < len(args):
            output_path = os.path.abspath(args[idx + 1])
        else:
            print("错误: -o 需要指定输出文件路径", file=sys.stderr)
            sys.exit(1)

    if not os.path.isfile(input_path):
        print(f"错误: 文件不存在或不是有效文件 - {input_path}", file=sys.stderr)
        sys.exit(1)

    from markitdown import MarkItDown

    md = MarkItDown()
    result = md.convert(input_path)
    content = result.text_content

    if not output_path:
        base = os.path.splitext(os.path.basename(input_path))[0]
        fd, output_path = tempfile.mkstemp(suffix=".md", prefix=base + "_")
        os.close(fd)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)

    print(output_path)


if __name__ == "__main__":
    main()