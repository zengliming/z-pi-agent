"""MarkItDown 环境检查与安装脚本
用法: python setup.py [--install]

检查 Python 版本和 MarkItDown 是否安装。
使用 --install 参数时，如果未安装则自动安装。
"""

import sys
import subprocess


def check_python():
    """检查 Python 版本 >= 3.10"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 10):
        print(f"错误: 需要 Python >= 3.10，当前版本 {version.major}.{version.minor}.{version.micro}")
        print("下载地址: https://www.python.org/downloads/")
        sys.exit(1)
    print(f"Python {version.major}.{version.minor}.{version.micro} - OK")


def check_markitdown():
    """检查 MarkItDown 是否已安装"""
    try:
        import markitdown  # noqa: F401
        print("MarkItDown - 已安装")
        return True
    except ImportError:
        print("MarkItDown - 未安装")
        return False


def install_markitdown():
    """安装 MarkItDown"""
    print("正在安装 MarkItDown...")
    try:
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "markitdown[all]"],
            stdout=sys.stdout,
            stderr=sys.stderr,
        )
        print("MarkItDown 安装成功")
        return True
    except subprocess.CalledProcessError:
        print("错误: MarkItDown 安装失败，请手动执行:")
        print(f"  {sys.executable} -m pip install \"markitdown[all]\"")
        return False


def main():
    auto_install = "--install" in sys.argv

    check_python()

    if check_markitdown():
        sys.exit(0)

    if auto_install:
        if install_markitdown():
            # 验证安装
            if check_markitdown():
                sys.exit(0)
        sys.exit(1)
    else:
        print()
        print("请运行以下命令安装 MarkItDown:")
        print(f"  {sys.executable} -m pip install \"markitdown[all]\"")
        print()
        print("或运行: python setup.py --install 自动安装")
        sys.exit(1)


if __name__ == "__main__":
    main()