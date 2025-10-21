from setuptools import setup

setup(
    name="rzemieslnik-oioioi-api-tool",
    version="1.0.0",
    author="Your Name",
    description="OIOIOI API automation tool with Flask interface and CLI",
    packages=[],
    py_modules=["__app", "__cli"],
    include_package_data=True,
    install_requires=[
        "flask",
        "flask-cors",
        "requests",
    ],
    entry_points={
        "console_scripts": [
            "rzemieslnik=__app:main",
            "rzemieslnik-cli=__cli:main",
        ]
    },
    python_requires=">=3.8",
)
