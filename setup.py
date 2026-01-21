from setuptools import setup, find_packages

setup(
    name='MOSEE',
    version='2.0.0',
    description='Margin of Safety & Earnings to Equity Stock Analyzer',
    long_description='''
MOSEE is a terminal-based stock investment analyzer that calculates:
- Margin of Safety (MoS) using DCF, PAD, and Book Value methods
- Earnings to Equity ratios
- Combined MOSEE scores for ranking investment opportunities
- Confidence scores based on data quality and metric consistency

Features:
- Interactive CLI for monthly stock analysis
- PDF one-pager reports for quick stock review
- Historical tracking and month-over-month comparisons
- Multiple filter options (country, industry, market cap)
- Uses FREE APIs (yfinance, forex_python)
    ''',
    author='Patrick Doran',
    author_email='patrick@example.com',
    url='https://github.com/patrickdoran/MOSEE',
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        # Data retrieval
        'yfinance>=0.2.0',
        'forex-python>=1.8',
        # Data processing
        'pandas>=2.0.0',
        'numpy>=1.24.0',
        'scikit-learn>=1.3.0',
        # Visualization
        'matplotlib>=3.7.0',
        # CLI and terminal display
        'click>=8.1.0',
        'rich>=13.0.0',
        # PDF generation
        'reportlab>=4.0.0',
    ],
    entry_points={
        'console_scripts': [
            'mosee=mosee_cli:cli',
        ],
    },
    classifiers=[
        'Development Status :: 4 - Beta',
        'Intended Audience :: Financial and Insurance Industry',
        'Topic :: Office/Business :: Financial :: Investment',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
        'Programming Language :: Python :: 3.11',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
    ],
    python_requires='>=3.9',
)
